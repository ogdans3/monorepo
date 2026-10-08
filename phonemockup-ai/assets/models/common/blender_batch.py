"""Run one saved batch script, then bypass a host PulseAudio shutdown deadlock.
Usage: blender -b file.blend --python blender_batch.py -- path/to/script.py [args]
Only batch work uses this wrapper; the interactive Blender project is unchanged.
"""
import os,sys,runpy,traceback
args=sys.argv[sys.argv.index('--')+1:]
script=args[0]
sys.argv=['blender']+(['--']+args[1:] if len(args)>1 else [])
status=0
try:runpy.run_path(script,run_name='__main__')
except SystemExit as e:status=e.code or 0
except BaseException:
    traceback.print_exc();status=1
sys.stdout.flush();sys.stderr.flush();os._exit(status)
