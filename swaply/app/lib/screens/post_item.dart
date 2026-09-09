import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../design/tokens.dart';
import '../state/session.dart';
import '../widgets/common.dart';
import '../widgets/shell.dart';
import 'onboarding.dart';

/// What a picker gives back: the bytes and a name to send them under. Named so
/// the screen does not have to know whether they came from a camera roll, a
/// file input in a browser, or a test.
class PickedPhoto {
  const PickedPhoto(this.bytes, this.name);
  final List<int> bytes;
  final String name;
}

/// 10b Legg ut gjenstand. Step one of two: if there is no profile yet, step two
/// is screen 10c, which is why the header counts.
class PostItemScreen extends StatefulWidget {
  const PostItemScreen({super.key, this.pickImage});

  /// Injected by the widget tests, which have no camera roll. Null everywhere
  /// else, and then the system picker is used.
  final Future<PickedPhoto?> Function()? pickImage;

  @override
  State<PostItemScreen> createState() => _PostItemScreenState();
}

class _PostItemScreenState extends State<PostItemScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _value = TextEditingController();
  final _postal = TextEditingController();
  final _subcategory = TextEditingController();
  final _photos = <UploadedImage>[];
  bool _uploading = false;

  String _kind = 'item';
  String _category = 'verktoy';
  String? _condition = 'good';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_title, _description, _value, _postal, _subcategory]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final session = context.read<Session>();
    // Looking around on a device counts as no account here: a thing on the
    // market has to belong to somebody with a name, so 10c comes first and the
    // account this device already has is claimed rather than replaced.
    if (!session.signedIn || session.anonymous) {
      // Step 2/2: no profile yet, so the profile screen comes first.
      await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => const CreateProfileScreen(continuingToListing: true)));
      if (!mounted) return;
      final now = context.read<Session>();
      if (!now.signedIn || now.anonymous) return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<SwaplyApi>().createItem({
        'kind': _kind,
        'title': _title.text.trim(),
        if (_description.text.trim().isNotEmpty) 'description': _description.text.trim(),
        'category': _category,
        if (_subcategory.text.trim().isNotEmpty) 'subcategory': _subcategory.text.trim(),
        if (_kind == 'item') 'condition': _condition,
        if (_value.text.trim().isNotEmpty) 'estimatedValueNok': int.tryParse(_value.text.trim()),
        if (_postal.text.trim().isNotEmpty) 'postalCode': _postal.text.trim(),
        'media': [for (final photo in _photos) photo.path],
      });
      if (!mounted) return;
      await context.read<Session>().refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lagt ut. Nå kan folk like den.')),
      );
      Navigator.of(context).pushNamedAndRemoveUntil('/profile', (r) => false);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// 10b «Legg til bilder». The picture is shrunk on the phone before it is
  /// sent: a camera makes five megabytes and a listing needs a few hundred
  /// kilobytes, and the smaller of the two is also the one that loads on a bus.
  ///
  /// The picker is injectable because a widget test has no camera roll, and the
  /// half worth testing is everything after it.
  Future<void> _addPhoto() async {
    if (_uploading) return;

    final picked = widget.pickImage != null
        ? await widget.pickImage!()
        : await ImagePicker()
            .pickImage(source: ImageSource.gallery, maxWidth: 1600, maxHeight: 1600, imageQuality: 82)
            .then((file) async =>
                file == null ? null : PickedPhoto(await file.readAsBytes(), file.name));
    if (picked == null || !mounted) return;

    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final image =
          await context.read<SwaplyApi>().uploadImage(picked.bytes, filename: picked.name);
      if (mounted) setState(() => _photos.add(image));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final watched = context.watch<Session>();
    final signedIn = watched.signedIn && !watched.anonymous;

    return SwaplyScaffold(
      currentTab: 1,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Insets.screen, Insets.sm, Insets.screen, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // «Legg ut en gjenstand» and «1/2» do not both fit on a narrow
                // phone, and the heading is the one that may give way.
                const Flexible(child: Text('Legg ut en gjenstand', style: Type.title)),
                if (!signedIn) const Text('1/2', style: Type.small),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(Insets.screen),
              children: [
                _photoStrip(),
                const SizedBox(height: Insets.lg),
                _label('Tittel'),
                TextField(
                  controller: _title,
                  // The button below reads this field, so it has to be rebuilt
                  // as it is typed into.
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(hintText: 'Bosch drill 18V'),
                ),
                const SizedBox(height: Insets.md),
                _label('Beskrivelse'),
                TextField(
                  controller: _description,
                  minLines: 3,
                  maxLines: 6,
                  decoration: const InputDecoration(hintText: 'Hva bør folk vite?'),
                ),
                const SizedBox(height: Insets.md),
                _label('Anslått verdi'),
                TextField(
                  controller: _value,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(hintText: '600', suffixText: 'kr'),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text('Helt billige ting kan være gratis', style: Type.small),
                ),
                const SizedBox(height: Insets.md),
                _label('Type'),
                Row(
                  children: [
                    _pick('Gjenstand', _kind == 'item', () => setState(() => _kind = 'item')),
                    const SizedBox(width: Insets.sm),
                    _pick('Tjeneste', _kind == 'service', () {
                      // A service has no condition, and it is never reserved.
                      setState(() {
                        _kind = 'service';
                        _condition = null;
                      });
                    }),
                  ],
                ),
                const SizedBox(height: Insets.md),
                _label('Hovedkategori'),
                DropdownButtonFormField<String>(
                  initialValue: _category,
                  items: categoryLabels.entries
                      .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                      .toList(),
                  onChanged: (v) => setState(() => _category = v ?? _category),
                ),
                const SizedBox(height: Insets.md),
                _label('Underkategori'),
                TextField(
                  controller: _subcategory,
                  decoration: const InputDecoration(hintText: 'Elektroverktøy'),
                ),
                if (_kind == 'item') ...[
                  const SizedBox(height: Insets.md),
                  _label('Tilstand'),
                  Row(
                    children: conditionLabels.entries
                        .map((e) => Padding(
                              padding: const EdgeInsets.only(right: Insets.sm),
                              child: _pick(e.value, _condition == e.key,
                                  () => setState(() => _condition = e.key)),
                            ))
                        .toList(),
                  ),
                ],
                const SizedBox(height: Insets.md),
                _label('Postnummer'),
                TextField(
                  controller: _postal,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  decoration: const InputDecoration(hintText: '7030', counterText: ''),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text('Kun by vises for andre', style: Type.small),
                ),
                if (_error != null) ...[
                  const SizedBox(height: Insets.md),
                  Text(_error!, style: const TextStyle(color: SwaplyColors.red, fontSize: 13)),
                ],
                const SizedBox(height: Insets.lg),
                PrimaryButton(
                  signedIn ? 'Legg ut' : 'Neste',
                  busy: _busy,
                  // Enabled either way: a disabled button explains nothing, and
                  // an empty title should be told, not silently refused.
                  onPressed: _title.text.trim().isEmpty
                      ? () => setState(() => _error = 'Gi gjenstanden en tittel.')
                      : _submit,
                ),
                const SizedBox(height: Insets.lg),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: Type.small),
      );

  Widget _photoStrip() => SizedBox(
        height: 104,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            GestureDetector(
              onTap: _photos.length >= 10 ? null : _addPhoto,
              child: Container(
                width: 104,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(Radii.card),
                  border: Border.all(color: SwaplyColors.line),
                ),
                child: _uploading
                    ? const Center(
                        child: SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.2),
                        ),
                      )
                    : const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add, color: SwaplyColors.greenPressed),
                          SizedBox(height: 4),
                          Text('Legg til bilder', style: Type.small),
                          Text('opptil 10', style: Type.small),
                        ],
                      ),
              ),
            ),
            ..._photos.asMap().entries.map((entry) => Padding(
                  padding: const EdgeInsets.only(left: Insets.sm),
                  child: Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(Radii.card),
                        child: Image.network(entry.value.url,
                            height: 104,
                            width: 104,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => Container(
                                height: 104, width: 104, color: SwaplyColors.greenSoft)),
                      ),
                      if (entry.key == 0)
                        Positioned(
                          left: 6,
                          bottom: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: SwaplyColors.greenDeep,
                              borderRadius: BorderRadius.circular(Radii.pill),
                            ),
                            child: const Text('Forside',
                                style: TextStyle(color: Colors.white, fontSize: 10)),
                          ),
                        ),
                      Positioned(
                        right: 2,
                        top: 2,
                        child: GestureDetector(
                          onTap: () => setState(() => _photos.removeAt(entry.key)),
                          child: const CircleAvatar(
                            radius: 11,
                            backgroundColor: Colors.white,
                            child: Icon(Icons.close, size: 13),
                          ),
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      );

  Widget _pick(String label, bool selected, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: selected ? SwaplyColors.greenPressed : Colors.white,
            borderRadius: BorderRadius.circular(Radii.pill),
            border: Border.all(
                color: selected ? SwaplyColors.greenPressed : const Color(0x22064E3B)),
          ),
          child: Text(label,
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : SwaplyColors.ink)),
        ),
      );
}
