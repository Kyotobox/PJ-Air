/// render: Entry Point Granular para Motor de Render Incremental y Almacenamiento CAS (§39).
///
/// Contratos de renderizado en streaming, CAS (Content-Addressable Storage) y canarios de render.
library;

export 'src/render/incremental_render_spec.dart';
export 'src/render/cas_storage_engine.dart';
export 'src/render/fast_splice_engine.dart';
export 'src/render/incremental_render_canary.dart';
export 'src/render/studio_render_contract.dart';
