#[cfg(debug_assertions)]
use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;

#[cfg(debug_assertions)]
type ChildProcess = std::process::Child;

#[cfg(not(debug_assertions))]
type ChildProcess = tauri_plugin_shell::process::CommandChild;

// Store the backend process for cleanup
struct BackendProcess(Mutex<Option<ChildProcess>>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(debug_assertions)]
#[cfg(windows)]
fn spawn_backend(backend_path: &std::path::Path) -> Option<ChildProcess> {
    // Development mode on Windows: spawn backend in a completely new console window.
    // Using cmd /c start ensures stdout is properly attached to the new window,
    // avoiding Bad File Descriptor errors during uvicorn reload.
    let python_path = backend_path.join("venv").join("Scripts").join("python.exe");
    let title = format!("DataNexusBackend {}", std::process::id());
    
    let child = Command::new("cmd")
        .args([
            "/C",
            "start",
            &title,
            python_path.to_str().unwrap(),
            "-m",
            "uvicorn",
            "main:app",
            "--reload"
        ])
        .current_dir(backend_path)
        .spawn();

    match child {
        Ok(process) => {
            println!("Backend server started in dev mode with title: {}", title);
            Some(process)
        }
        Err(e) => {
            eprintln!("Failed to start backend server: {}", e);
            None
        }
    }
}

#[cfg(debug_assertions)]
#[cfg(not(windows))]
fn spawn_backend(backend_path: &std::path::Path) -> Option<ChildProcess> {
    // Development mode on Unix: spawn backend via python
    let python_path = backend_path.join("venv").join("bin").join("python");
    let python_cmd = if python_path.exists() {
        python_path.to_str().unwrap()
    } else {
        "python"
    };
    let child = Command::new(python_cmd)
        .args(["-m", "uvicorn", "main:app", "--reload"])
        .current_dir(backend_path)
        .spawn();

    match child {
        Ok(process) => {
            let pid = process.id();
            println!("Backend server started in dev mode with PID: {}", pid);
            Some(process)
        }
        Err(e) => {
            eprintln!("Failed to start backend server: {}", e);
            None
        }
    }
}

#[cfg(not(debug_assertions))]
fn spawn_backend_sidecar(app: &tauri::AppHandle) {
    // Build/production mode: use sidecar pattern
    match app.shell().sidecar("backend") {
        Ok(sidecar_command) => {
            match sidecar_command.spawn() {
                Ok((mut _rx, child)) => {
                    println!("Backend sidecar started");
                    let state = app.state::<BackendProcess>();
                    *state.0.lock().unwrap() = Some(child);
                }
                Err(e) => {
                    eprintln!("Failed to spawn backend sidecar: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to create sidecar command: {}", e);
        }
    }
}

#[cfg(debug_assertions)]
#[cfg(windows)]
fn kill_backend(_process: ChildProcess) {
    // Development mode on Windows: use taskkill to forcefully kill process tree.
    // Since we spawned it via `start` with a unique title, we kill by WINDOWTITLE.
    let title = format!("DataNexusBackend {}", std::process::id());
    let _ = Command::new("taskkill")
        .args(["/F", "/T", "/FI", &format!("WINDOWTITLE eq {}*", title)])
        .status();
    println!("Backend server stopped");
}

#[cfg(debug_assertions)]
#[cfg(not(windows))]
fn kill_backend(mut process: ChildProcess) {
    // Development mode on Unix: kill the spawned process directly
    let _ = process.kill();
    println!("Backend server stopped");
}

#[cfg(not(debug_assertions))]
fn kill_backend(process: ChildProcess) {
    // Build/production mode: kill the sidecar child process tree
    // PyInstaller extracts and spawns a child process, so we must kill the whole tree.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/IM", "backend.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = process.kill();
    }
    println!("Backend sidecar stopped");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
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
            println!("Debug mode: {}", cfg!(debug_assertions));

            #[cfg(debug_assertions)]
            {
                // Development mode: spawn using shell commands
                if let Some(process) = spawn_backend(&backend_path) {
                    let state = app.state::<BackendProcess>();
                    *state.0.lock().unwrap() = Some(process);
                }
            }

            #[cfg(not(debug_assertions))]
            {
                // Build mode: use sidecar pattern
                spawn_backend_sidecar(&app.handle());
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<BackendProcess>();
                let mut guard = state.0.lock().unwrap();
                if let Some(process) = guard.take() {
                    kill_backend(process);
                }
            }
        });
}
