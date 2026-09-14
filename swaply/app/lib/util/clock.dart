/// The one place the app asks what time it is, so a test can answer.
///
/// «i går» and «tirsdag» are relative to today, and a golden that says them
/// would otherwise change every morning. Production never sets this.
DateTime Function() now = DateTime.now;
