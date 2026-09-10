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
            padding: const EdgeInsets.fromLTRB(22, 8, 22, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // «Legg ut en gjenstand» and «1/2» do not both fit on a narrow
                // phone, and the heading is the one that may give way.
                const Flexible(child: Text('Legg ut en gjenstand', style: Type.screen)),
                if (!signedIn)
                  const Text('1/2',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700, color: SwaplyColors.grey)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(22, 13, 22, 0),
              children: [
                _photoStrip(),
                const SizedBox(height: 14),
                _label('Tittel'),
                TextField(
                  controller: _title,
                  // The button below reads this field, so it has to be rebuilt
                  // as it is typed into.
                  onChanged: (_) => setState(() {}),
                  style: _fieldText,
                  decoration: _field('Bosch drill 18V'),
                ),
                const SizedBox(height: 12),
                _label('Beskrivelse'),
                TextField(
                  controller: _description,
                  minLines: 3,
                  maxLines: 6,
                  style: _fieldText,
                  decoration: _field('Hva bør folk vite?'),
                ),
                const SizedBox(height: 12),
                _label('Anslått verdi'),
                Row(
                  children: [
                    Expanded(
                      flex: 5,
                      child: TextField(
                        controller: _value,
                        keyboardType: TextInputType.number,
                        style: _fieldText,
                        // suffixText hides until the field has focus; the
                        // export shows «kr» from the start.
                        decoration: _field('600').copyWith(
                            suffixIcon: const Padding(
                                padding: EdgeInsets.only(right: 14),
                                child: Text('kr',
                                    style: TextStyle(fontSize: 14, color: SwaplyColors.grey))),
                            suffixIconConstraints:
                                const BoxConstraints(minWidth: 0, minHeight: 0)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      flex: 4,
                      child: Text('Helt billige ting kan være gratis',
                          style: TextStyle(fontSize: 11.5, height: 1.3, color: SwaplyColors.greyLight)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
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
                const SizedBox(height: 12),
                // Two columns, as the export sets them: category beside
                // subcategory, condition beside postcode.
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Hovedkategori'),
                          DropdownButtonFormField<String>(
                            initialValue: _category,
                            isDense: true,
                            // Not `_fieldText`: a dropdown swaps the ambient
                            // text style for its own, so the family has to
                            // come along explicitly.
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(fontSize: 14, color: SwaplyColors.ink),
                            icon: const Icon(Icons.keyboard_arrow_down,
                                size: 18, color: SwaplyColors.greySoft),
                            decoration: _field(''),
                            items: categoryLabels.entries
                                .map((e) => DropdownMenuItem(
                                    value: e.key,
                                    child: Text(e.value, overflow: TextOverflow.ellipsis)))
                                .toList(),
                            onChanged: (v) => setState(() => _category = v ?? _category),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Underkategori'),
                          TextField(
                            controller: _subcategory,
                            style: _fieldText,
                            decoration: _field('Elektroverktøy'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_kind == 'item') ...[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _label('Tilstand'),
                            _segmented(),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _label('Postnummer'),
                          TextField(
                            controller: _postal,
                            keyboardType: TextInputType.number,
                            maxLength: 4,
                            style: _fieldText,
                            decoration: _field('7030').copyWith(counterText: ''),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text('Kun by vises for andre',
                      style: TextStyle(fontSize: 10, color: SwaplyColors.grey)),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: SwaplyColors.red, fontSize: 13)),
                ],
                const SizedBox(height: 12),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 30),
            child: PrimaryButton(
              signedIn ? 'Legg ut' : 'Neste',
              busy: _busy,
              // Enabled either way: a disabled button explains nothing, and
              // an empty title should be told, not silently refused.
              onPressed: _title.text.trim().isEmpty
                  ? () => setState(() => _error = 'Gi gjenstanden en tittel.')
                  : _submit,
            ),
          ),
        ],
      ),
    );
  }

  static const _fieldText = TextStyle(fontSize: 14, color: SwaplyColors.ink);

  /// The export's fields on this screen are a size smaller than the sign-in
  /// ones: 14px in 11/14 padding on a 14 radius.
  InputDecoration _field(String hint) => InputDecoration(
        hintText: hint.isEmpty ? null : hint,
        hintStyle: const TextStyle(fontSize: 14, color: SwaplyColors.greyLight),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: Type.section),
      );

  /// Condition as a three-way segment, 31 tall in a chip-coloured track.
  Widget _segmented() => Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: SwaplyColors.chip,
          borderRadius: BorderRadius.circular(11),
        ),
        child: Row(
          children: conditionLabels.entries
              .map((e) => Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _condition = e.key),
                      child: Container(
                        height: 31,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _condition == e.key ? Colors.white : null,
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: Text(e.value,
                            style: TextStyle(
                                fontSize: 12.5,
                                fontWeight:
                                    _condition == e.key ? FontWeight.w700 : FontWeight.w600,
                                color: _condition == e.key
                                    ? SwaplyColors.ink
                                    : SwaplyColors.greySoft)),
                      ),
                    ),
                  ))
              .toList(),
        ),
      );

  Widget _photoStrip() => SizedBox(
        height: 106,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            GestureDetector(
              onTap: _photos.length >= 10 ? null : _addPhoto,
              child: Container(
                width: 106,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F7F3),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFB9C4BC)),
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
                          Text('+',
                              style: TextStyle(
                                  fontSize: 26, height: 1, color: SwaplyColors.greenText)),
                          SizedBox(height: 4),
                          Text('Legg til bilder',
                              style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: SwaplyColors.greenText)),
                          Text('opptil 10',
                              style: TextStyle(fontSize: 9, color: SwaplyColors.grey)),
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
                            height: 106,
                            width: 106,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => Container(
                                height: 106, width: 106, color: SwaplyColors.greenSoft)),
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
                                style: TextStyle(
                                    color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
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
