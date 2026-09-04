use std::path::PathBuf;
use std::process::Command;

/// Ищет Java в системных переменных окружения (PATH)
pub fn find_java() -> Result<PathBuf, String> {
    // Пробуем выполнить команду java -version
    let output = Command::new("java")
        .arg("-version")
        .output();
    
    match output {
        Ok(_) => {
            // Если команда выполнилась успешно, значит java есть в PATH
            Ok(PathBuf::from("java"))
        }
        Err(_) => {
            Err("Java не найдена в системе. Пожалуйста, установите JDK 21.".to_string())
        }
    }
}

/// (Опционально) Более строгая проверка, что это именно 21 версия
pub fn check_java_21() -> Result<bool, String> {
    let output = Command::new("java")
        .arg("-version")
        .output()
        .map_err(|e| e.to_string())?;
    
    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(stderr.contains("21") || stderr.contains("1.8")) // 1.8 для старых версий, 21 для новых
}