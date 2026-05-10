const ALLOWED_COMMANDS: &[&str] = &["status", "health", "version"];
const ALLOWED_DEEP_LINK_SCHEMES: &[&str] = &["aa://", "https://", "http://"];

fn is_command_allowed(command: &str) -> bool {
    ALLOWED_COMMANDS.contains(&command)
}

fn is_allowed_deep_link(url: &str) -> bool {
    ALLOWED_DEEP_LINK_SCHEMES
        .iter()
        .any(|scheme| url.starts_with(scheme))
}

#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[tauri::command]
fn open_deep_link(url: String) -> Result<String, String> {
    if !is_allowed_deep_link(&url) {
        return Err(format!("Deep link scheme not allowed: {}", url));
    }
    Ok(format!("opened:{url}"))
}

#[tauri::command]
fn run_shell(command: String) -> Result<String, String> {
    if !is_command_allowed(&command) {
        return Err(format!("Command not allowed: {}", command));
    }
    Ok(format!("linux:{command}"))
}

#[tauri::command]
fn dbus_notify(summary: String, body: String) -> Result<String, String> {
    if summary.trim().is_empty() {
        return Err("D-Bus notification summary must be non-empty".to_string());
    }
    Ok(format!("dbus_notify:{summary}:{body}"))
}

#[tauri::command]
fn xdg_open(target: String) -> Result<String, String> {
    if target.trim().is_empty() {
        return Err("XDG target must be non-empty".to_string());
    }
    Ok(format!("xdg_open:{target}"))
}

#[tauri::command]
fn detect_display_server() -> &'static str {
    "wayland"
}

#[tauri::command]
fn get_theme_preference() -> &'static str {
    "dark"
}

#[tauri::command]
fn register_system_tray() -> &'static str {
    "tray_registered"
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
            get_theme_preference,
            register_system_tray
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri linux baseline");
}
