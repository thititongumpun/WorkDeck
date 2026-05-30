use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    configure_linux_webkit_renderer();

    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_workspace_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_resource_credentials",
            sql: include_str!("../migrations/002_resource_credentials.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_resource_pinned",
            sql: include_str!("../migrations/003_resource_pinned.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_resource_target",
            sql: include_str!("../migrations/004_resource_target.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:workdeck.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running WorkDeck");
}

fn configure_linux_webkit_renderer() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }

        if std::env::var_os("LIBGL_ALWAYS_SOFTWARE").is_none() {
            std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
        }
    }
}
