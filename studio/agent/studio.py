#!/usr/bin/env python3
"""Small MCP client for external agents. Only uses Python's standard library."""
import argparse
import json
import os
import sys
import urllib.request

parser = argparse.ArgumentParser(description='Studio: MCP-verktøy og filopplasting')
parser.add_argument('--url', default=os.getenv('STUDIO_URL', 'http://localhost:8088'))
sub = parser.add_subparsers(dest='command', required=True)
call = sub.add_parser('call'); call.add_argument('tool'); call.add_argument('arguments', nargs='?', default='{}')
sub.add_parser('tools'); sub.add_parser('context')
upload = sub.add_parser('upload'); upload.add_argument('path'); upload.add_argument('--title'); upload.add_argument('--rights', default='unknown'); upload.add_argument('--ad-id'); upload.add_argument('--item-id'); upload.add_argument('--expected-version-id'); upload.add_argument('--body', default='')
args = parser.parse_args()
key = os.environ.get('STUDIO_AGENT_TOKEN')
if not key: parser.error('Sett STUDIO_AGENT_TOKEN i miljøet')


def request(path, payload=None, method='POST', headers=None):
    raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
    req = urllib.request.Request(args.url.rstrip('/') + path, raw, method=method, headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/octet-stream' if isinstance(payload, bytes) else 'application/json', **(headers or {})})
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.load(response)


def mcp(method, params):
    return request('/mcp', {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params})


if args.command == 'upload':
    size = os.path.getsize(args.path)
    if args.ad_id and args.item_id:
        parser.error('Use either --ad-id or --item-id, not both')
    fields = {'file_name': os.path.basename(args.path), 'title': args.title or os.path.basename(args.path), 'size': size, 'rights': args.rights, 'body': args.body}
    if args.ad_id:
        response = mcp('tools/call', {'name': 'studio_get_ad', 'arguments': {'ad_id': args.ad_id}})['result']
        if response.get('isError'):
            parser.error(response['content'][0]['text'])
        ad = json.loads(response['content'][0]['text'])
        expected = args.expected_version_id if args.expected_version_id is not None else ad['item'].get('current_version_id') or ''
        response = mcp('tools/call', {'name': 'studio_prepare_ad_upload', 'arguments': {'ad_id': args.ad_id, 'expected_version_id': expected, 'file_name': fields['file_name'], 'title': fields['title'], 'size': str(size), 'body': args.body}})['result']
        if response.get('isError'):
            parser.error(response['content'][0]['text'])
        session = json.loads(response['content'][0]['text'])
    else:
        if args.item_id:
            if args.expected_version_id is None:
                parser.error('--item-id requires --expected-version-id from studio_get_item')
            fields.update(item_id=args.item_id, expected_version_id=args.expected_version_id)
        session = request('/api/agent/upload-sessions', fields)
    with open(args.path, 'rb') as stream:
        offset = 0
        while chunk := stream.read(8 * 1024 * 1024):
            state = request('/api/agent/upload-sessions/' + session['id'], chunk, 'PATCH', {'Upload-Offset': str(offset)})
            offset = state['offset_bytes']
    result = request('/api/agent/upload-sessions/' + session['id'] + '/complete', {})
else:
    mcp('initialize', {'protocolVersion': '2025-06-18', 'clientInfo': {'name': 'studio-cli', 'version': '1.0.0'}, 'capabilities': {}})
    if args.command == 'tools': result = mcp('tools/list', {})
    else:
        tool = 'studio_context' if args.command == 'context' else args.tool
        arguments = {} if args.command == 'context' else json.loads(args.arguments)
        result = mcp('tools/call', {'name': tool, 'arguments': arguments})
print(json.dumps(result, ensure_ascii=False, indent=2))
