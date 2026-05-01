#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[tauri::command]
fn open_deep_link(url: String) -> String {
    // §185-2170 FIX: Validate URL scheme before processing.
    // Root cause: No validation meant javascript:, file:, or other dangerous schemes
    // could be passed through, enabling XSS or local file access attacks.
    // Fix: Only allow http and https schemes.
    if let Some(scheme) = url.split(':').next() {
        if scheme.eq_ignore_ascii_case("http") || scheme.eq_ignore_ascii_case("https") {
            return format!("opened:{url}");
        }
    }
    format!("rejected:invalid_scheme")
}

// Command allowlist for shell execution - only predefined safe commands permitted
const ALLOWED_COMMANDS: &[&str] = &["status", "health", "version"];

fn is_command_allowed(command: &str) -> bool {
    ALLOWED_COMMANDS.contains(&command.as_str())
}

#[tauri::command]
fn run_shell(command: String) -> Result<String, String> {
    if !is_command_allowed(&command) {
        return Err(format!("Command not allowed: {}", command));
    }
    Ok(format!("macos:{command}"))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![healthcheck, open_deep_link, run_shell])
        .run(tauri::generate_context!())
        .expect("failed to run tauri macOS baseline");
}
