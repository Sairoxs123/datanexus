use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

// Store the backend process ID for cleanup
struct BackendProcess(Mutex<Option<u32>>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(windows)]
fn spawn_backend(backend_path: &std::path::Path) -> Option<u32> {
    use std::os::windows::process::CommandExt;

    // Use 'cmd /C start' instead of direct spawning.
    // This allows the OS to do the heavy lifting of window creation and stdio setup.
    // While we lose the direct PID of python (we get cmd's PID),
    // the window title trick in kill_backend works reliably for cleanup.
    let child = Command::new("cmd")
        .args([
            "/c",
            "start",
            "DataNexus Backend",
            "cmd",
            "/k",
            "python -m uvicorn main:app --reload",
        ])
        .current_dir(backend_path)
        .spawn();

    match child {
        Ok(process) => {
            let pid = process.id();
            println!("Backend server started with PID: {}", pid);
            Some(pid)
        }
        Err(e) => {
            eprintln!("Failed to start backend server: {}", e);
            None
        }
    }
}

#[cfg(not(windows))]
fn spawn_backend(backend_path: &std::path::Path) -> Option<u32> {
    let child = Command::new("python")
        .args(["-m", "uvicorn", "main:app", "--reload"])
        .current_dir(backend_path)
        .spawn();

    match child {
        Ok(process) => {
            let pid = process.id();
            println!("Backend server started with PID: {}", pid);
            Some(pid)
        }
        Err(e) => {
            eprintln!("Failed to start backend server: {}", e);
            None
        }
    }
}

#[cfg(windows)]
fn kill_backend(_pid: u32) {
    // Kill the backend window by its title.
    // The PID we have is just the launcher CMD which might maintain a handle,
    // but the actual window is a separate process.
    let _ = Command::new("taskkill")
        .args(["/F", "/FI", "WINDOWTITLE eq DataNexus Backend*"])
        .output();
    println!("Backend server stopped");
}

#[cfg(not(windows))]
fn kill_backend(pid: u32) {
    use std::process::Stdio;
    // Kill process group on Unix
    let _ = Command::new("kill")
        .args(["-9", &format!("-{}", pid)])
        .stderr(Stdio::null())
        .output();
    println!("Backend server stopped (PID: {})", pid);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            // Get the path to the backend directory
            let backend_dir = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap())
                .parent()
                .map(|p| p.join("backend"))
                .unwrap_or_else(|| std::path::PathBuf::from("backend"));

            // In development, use the workspace backend folder
            let backend_path = if cfg!(debug_assertions) {
                std::env::current_dir()
                    .unwrap()
                    .parent()
                    .map(|p| p.join("backend"))
                    .unwrap_or_else(|| std::path::PathBuf::from("backend"))
            } else {
                backend_dir
            };

            println!("Starting backend from: {:?}", backend_path);

            if let Some(pid) = spawn_backend(&backend_path) {
                let state = app.state::<BackendProcess>();
                *state.0.lock().unwrap() = Some(pid);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the backend process when the window is destroyed
                let state: tauri::State<BackendProcess> = window.state();
                let mut guard = state.0.lock().unwrap();
                if let Some(pid) = guard.take() {
                    kill_backend(pid);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
