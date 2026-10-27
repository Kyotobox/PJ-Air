import 'dart:convert';

import '../../axiom_version.dart';

/// [G11] SignatureModel: Estandarización de firmas criptográficas para la flota.
@AxiomVersion('1.0.0')
class SignatureModel {
  final String challenge;
  final String signature;
  final String project;
  final String timestamp;
  final String status;
  final String? signerAgentId;

  SignatureModel({
    required this.challenge,
    required this.signature,
    required this.project,
    required this.timestamp,
    required this.status,
    this.signerAgentId,
  });

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'challenge': challenge,
      'signature': signature,
      'project': project,
      'timestamp': timestamp,
      'status': status,
      if (signerAgentId != null) 'signer_agent_id': signerAgentId,
    };
  }

  factory SignatureModel.fromJson(Map<String, dynamic> json) {
    return SignatureModel(
      challenge: json['challenge'] ?? '',
      signature: json['signature'] ?? '',
      project: json['project'] ?? '',
      timestamp: json['timestamp'] ?? '',
      status: json['status'] ?? '',
      signerAgentId: json['signer_agent_id'],
    );
  }

  String encode() => jsonEncode(toJson());
}
