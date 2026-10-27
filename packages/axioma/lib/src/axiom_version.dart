/// Annotation to mark the version of a business axiom (entity).
/// This allows the Governance Kernel to track versioning independently
/// from the core system version.
class AxiomVersion {
  final String version;

  const AxiomVersion(this.version);
}
