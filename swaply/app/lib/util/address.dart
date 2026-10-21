import 'address_stub.dart' if (dart.library.js_interop) 'address_web.dart' as platform;

/// The query parameter an invitation opens the web build with: the page
/// behind `/i/<token>` sends people to `<app>/?invitasjon=<token>`.
const inviteParameter = 'invitasjon';

/// Takes [inviteParameter] out of the address the app was opened at, once the
/// gate has done what the link was for. Left there, every reload of the page
/// read the same key again and opened the same shared listing over Oppdag.
/// Nothing off the web, where the address is not the person's to reload.
///
/// A variable so that a test, which has no browser, can see it called.
void Function() forgetInviteInAddress = platform.forgetInviteInAddress;
