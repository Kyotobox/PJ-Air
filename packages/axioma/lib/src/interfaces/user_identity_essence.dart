import '../axiom_version.dart';

/// UserIdentityEssence: Interfaz para la federación de identidades y permisos.
/// Permite que un búnker valide la autoridad de un usuario proveniente de otro nodo.
@AxiomVersion('1.0.0')
abstract class UserIdentityEssence {
  /// Identificador único del usuario (UUID/Email).
  String get userId;

  /// Nombre legible para mostrar en la UI.
  String get displayName;

  /// Rol canónico (propietario, administrador, usuario, etc).
  String get role;

  /// Lista de capacidades o permisos autorizados.
  List<String> get permissions;

  /// Indica si la identidad está activa y autorizada.
  bool get isAuthorized;
}
