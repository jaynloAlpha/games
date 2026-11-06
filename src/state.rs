use std::sync::Arc;

use crate::store::Store;

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<Store>,
}
