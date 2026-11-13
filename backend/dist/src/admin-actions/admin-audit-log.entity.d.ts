export declare class AdminAuditLog {
    id: string;
    admin_id: string;
    admin_name: string;
    action: string;
    target_entity: string;
    target_id: string;
    previous_state_json: string | null;
    new_state_json: string | null;
    notes: string | null;
    ip_address: string | null;
    created_at: Date;
}
