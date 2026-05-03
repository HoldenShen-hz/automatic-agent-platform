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

#[cfg(target_os = "macos")]
fn setup_macos_menu() {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    let quit = MenuItemBuilder::with_id("quit", "Quit Automatic Agent").build(&tauri::Context::default()).ok();
    let about = MenuItemBuilder::with_id("about", "About").build(&tauri::Context::default()).ok();
    let menu = MenuBuilder::new(&tauri::Context::default())
        .item(&about.unwrap())
        .separator()
        .item(&quit.unwrap())
        .build();
    let _ = tauri::window::Window::default().set_menu(menu);
}

// §R8-59: Native integrations - Keychain via secure storage, native menu, Spotlight export
#[tauri::command]
fn keychain_store(key: String, value: String) -> Result<String, String> {
    // Placeholder: tauri-plugin-secure-storage integration
    Ok(format!("stored:{}={}", key, value))
}

#[tauri::command]
fn keychain_retrieve(key: String) -> Result<String, String> {
    Ok(format!("retrieved:{}", key))
}

// §R8-59: Spotlight export helper for native macOS integration
#[tauri::command]
fn spotlight_export(metadata: String) -> Result<String, String> {
    Ok(format!("spotlight:{}", metadata))
}

pub fn run() {
    #[cfg(target_os = "macos")]
    setup_macos_menu();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![healthcheck, open_deep_link, run_shell, keychain_store, keychain_retrieve, spotlight_export])
        .run(tauri::generate_context!())
        .expect("failed to run tauri macOS baseline");
}
