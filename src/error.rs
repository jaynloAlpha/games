use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// 统一错误类型：对外输出 `{ "error": { "code", "message" } }`。
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    NotFound(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "not_found"),
            AppError::Io(err) if err.kind() == std::io::ErrorKind::NotFound => {
                (StatusCode::NOT_FOUND, "not_found")
            }
            AppError::Io(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
            AppError::Json(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
        };

        let message = match &self {
            AppError::Internal(_) => "服务器开小差了，请稍后再试".to_string(),
            AppError::Io(_) => "服务器开小差了，请稍后再试".to_string(),
            AppError::Json(err) => format!("请求内容格式不正确：{err}"),
            other => other.to_string(),
        };

        if status.is_server_error() {
            tracing::error!(error = %self, "request failed");
        }

        (
            status,
            Json(json!({ "error": { "code": code, "message": message } })),
        )
            .into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
