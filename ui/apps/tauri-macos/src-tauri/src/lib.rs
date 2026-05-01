#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[tauri::command]
fn open_deep_link(url: String) -> String {
    format!("opened:{url}")
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
