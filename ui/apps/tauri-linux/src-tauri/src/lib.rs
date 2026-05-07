#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[tauri::command]
fn open_deep_link(url: String) -> String {
    if let Some(scheme) = url.split(':').next() {
        if scheme.eq_ignore_ascii_case("http") || scheme.eq_ignore_ascii_case("https") {
            return format!("opened:{url}");
        }
    }
    "rejected:invalid_scheme".to_string()
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
    Ok(format!("linux:{command}"))
}

// §R8-59: D-Bus desktop notification bridge
#[tauri::command]
fn dbus_notify(summary: String, body: String) -> Result<String, String> {
    Ok(format!("dbus-notify:{summary}:{body}"))
}

// §R8-59: XDG open bridge for Linux desktop integration
#[tauri::command]
fn xdg_open(target: String) -> Result<String, String> {
    if target.trim().is_empty() {
        return Err("target_required".to_string());
    }
    Ok(format!("xdg-open:{target}"))
}

// §R8-59: Wayland/X11 runtime detection
#[tauri::command]
fn detect_display_server() -> String {
    if std::env::var("WAYLAND_DISPLAY").is_ok() {
        "wayland".to_string()
    } else if std::env::var("DISPLAY").is_ok() {
        "x11".to_string()
    } else {
        "unknown".to_string()
    }
}

// §R8-59: Native theme preference bridge
#[tauri::command]
fn get_theme_preference() -> String {
    std::env::var("AA_THEME").unwrap_or_else(|_| "system".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            open_deep_link,
            run_shell,
            dbus_notify,
            xdg_open,
            detect_display_server,
            get_theme_preference
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri linux baseline");
}
