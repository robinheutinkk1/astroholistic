/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with `npm run db:types` (Supabase CLI, authoritative) or
 * `npm run db:types:local` (introspection fallback, see
 * scripts/generate-db-types.mjs).
 *
 * The schema is the source of truth (masterprompt §41). A hand-edited type
 * that drifts from the database is worse than no type at all.
 */

export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          actor_user_id: string | null;
          actor_kind: Database['public']['Enums']['actor_kind'];
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          actor_user_id?: string | null;
          actor_kind?: Database['public']['Enums']['actor_kind'];
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          actor_user_id?: string | null;
          actor_kind?: Database['public']['Enums']['actor_kind'];
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_user_id_fkey';
            columns: ['actor_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      care_organization_users: {
        Row: {
          id: string;
          care_organization_id: string;
          user_id: string;
          status: Database['public']['Enums']['membership_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          care_organization_id: string;
          user_id: string;
          status?: Database['public']['Enums']['membership_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          care_organization_id?: string;
          user_id?: string;
          status?: Database['public']['Enums']['membership_status'];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'care_organization_users_care_organization_id_fkey';
            columns: ['care_organization_id'];
            isOneToOne: false;
            referencedRelation: 'care_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'care_organization_users_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      care_organizations: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          contact_email: string | null;
          phone: string | null;
          address_line1: string | null;
          postal_code: string | null;
          city: string | null;
          country: string;
          external_reference: string | null;
          status: Database['public']['Enums']['client_status'];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          contact_email?: string | null;
          phone?: string | null;
          address_line1?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string;
          external_reference?: string | null;
          status?: Database['public']['Enums']['client_status'];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          contact_email?: string | null;
          phone?: string | null;
          address_line1?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string;
          external_reference?: string | null;
          status?: Database['public']['Enums']['client_status'];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'care_organizations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      change_requests: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          ride_id: string | null;
          requested_by_user_id: string | null;
          requester_kind: Database['public']['Enums']['requester_kind'];
          kind: Database['public']['Enums']['change_request_kind'];
          payload: Json;
          status: Database['public']['Enums']['change_request_status'];
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          ride_id?: string | null;
          requested_by_user_id?: string | null;
          requester_kind: Database['public']['Enums']['requester_kind'];
          kind: Database['public']['Enums']['change_request_kind'];
          payload?: Json;
          status?: Database['public']['Enums']['change_request_status'];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          ride_id?: string | null;
          requested_by_user_id?: string | null;
          requester_kind?: Database['public']['Enums']['requester_kind'];
          kind?: Database['public']['Enums']['change_request_kind'];
          payload?: Json;
          status?: Database['public']['Enums']['change_request_status'];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'change_requests_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'change_requests_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'change_requests_requested_by_user_id_fkey';
            columns: ['requested_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'change_requests_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'change_requests_ride_id_fkey';
            columns: ['ride_id'];
            isOneToOne: false;
            referencedRelation: 'rides';
            referencedColumns: ['id'];
          },
        ];
      };
      client_care_organizations: {
        Row: {
          client_id: string;
          care_organization_id: string;
          valid_from: string;
          valid_to: string | null;
          created_at: string;
        };
        Insert: {
          client_id: string;
          care_organization_id: string;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
        };
        Update: {
          client_id?: string;
          care_organization_id?: string;
          valid_from?: string;
          valid_to?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_care_organizations_care_organization_id_fkey';
            columns: ['care_organization_id'];
            isOneToOne: false;
            referencedRelation: 'care_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_care_organizations_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      client_contacts: {
        Row: {
          client_id: string;
          contact_id: string;
          relationship: string | null;
          is_primary: boolean;
          can_view_rides: boolean;
          can_report_absence: boolean;
          can_request_changes: boolean;
          created_at: string;
        };
        Insert: {
          client_id: string;
          contact_id: string;
          relationship?: string | null;
          is_primary?: boolean;
          can_view_rides?: boolean;
          can_report_absence?: boolean;
          can_request_changes?: boolean;
          created_at?: string;
        };
        Update: {
          client_id?: string;
          contact_id?: string;
          relationship?: string | null;
          is_primary?: boolean;
          can_view_rides?: boolean;
          can_report_absence?: boolean;
          can_request_changes?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_contacts_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_contacts_contact_id_fkey';
            columns: ['contact_id'];
            isOneToOne: false;
            referencedRelation: 'contacts';
            referencedColumns: ['id'];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          address_line1: string | null;
          postal_code: string | null;
          city: string | null;
          country: string;
          external_reference: string | null;
          status: Database['public']['Enums']['client_status'];
          user_id: string | null;
          anonymized_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          home_location_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone?: string | null;
          email?: string | null;
          address_line1?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string;
          external_reference?: string | null;
          status?: Database['public']['Enums']['client_status'];
          user_id?: string | null;
          anonymized_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          home_location_id?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          address_line1?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string;
          external_reference?: string | null;
          status?: Database['public']['Enums']['client_status'];
          user_id?: string | null;
          anonymized_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          home_location_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_home_location_id_fkey';
            columns: ['home_location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'clients_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      contacts: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          user_id: string | null;
          status: Database['public']['Enums']['client_status'];
          anonymized_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone?: string | null;
          email?: string | null;
          user_id?: string | null;
          status?: Database['public']['Enums']['client_status'];
          anonymized_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          user_id?: string | null;
          status?: Database['public']['Enums']['client_status'];
          anonymized_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'contacts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      driver_vehicles: {
        Row: {
          driver_id: string;
          vehicle_id: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          driver_id: string;
          vehicle_id: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          driver_id?: string;
          vehicle_id?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'driver_vehicles_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: true;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'driver_vehicles_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      drivers: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          employee_number: string | null;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          status: Database['public']['Enums']['driver_status'];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          employee_number?: string | null;
          first_name: string;
          last_name: string;
          phone?: string | null;
          email?: string | null;
          status?: Database['public']['Enums']['driver_status'];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          employee_number?: string | null;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          email?: string | null;
          status?: Database['public']['Enums']['driver_status'];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'drivers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'drivers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      locations: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          kind: Database['public']['Enums']['location_kind'];
          address_line1: string | null;
          postal_code: string | null;
          city: string | null;
          country: string;
          latitude: number | null;
          longitude: number | null;
          geocode_status: Database['public']['Enums']['geocode_status'];
          geocode_provider: string | null;
          provider_place_ref: string | null;
          access_notes: string | null;
          status: Database['public']['Enums']['client_status'];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          kind?: Database['public']['Enums']['location_kind'];
          address_line1?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string;
          latitude?: number | null;
          longitude?: number | null;
          geocode_status?: Database['public']['Enums']['geocode_status'];
          geocode_provider?: string | null;
          provider_place_ref?: string | null;
          access_notes?: string | null;
          status?: Database['public']['Enums']['client_status'];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          kind?: Database['public']['Enums']['location_kind'];
          address_line1?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string;
          latitude?: number | null;
          longitude?: number | null;
          geocode_status?: Database['public']['Enums']['geocode_status'];
          geocode_provider?: string | null;
          provider_place_ref?: string | null;
          access_notes?: string | null;
          status?: Database['public']['Enums']['client_status'];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'locations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      nfc_tags: {
        Row: {
          id: string;
          organization_id: string;
          public_code: string;
          token_hash: string;
          client_id: string | null;
          status: Database['public']['Enums']['tag_status'];
          label: string | null;
          replaced_by_tag_id: string | null;
          activated_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          public_code: string;
          token_hash: string;
          client_id?: string | null;
          status?: Database['public']['Enums']['tag_status'];
          label?: string | null;
          replaced_by_tag_id?: string | null;
          activated_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          public_code?: string;
          token_hash?: string;
          client_id?: string | null;
          status?: Database['public']['Enums']['tag_status'];
          label?: string | null;
          replaced_by_tag_id?: string | null;
          activated_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'nfc_tags_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: true;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nfc_tags_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nfc_tags_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'nfc_tags_replaced_by_tag_id_fkey';
            columns: ['replaced_by_tag_id'];
            isOneToOne: false;
            referencedRelation: 'nfc_tags';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          recipient_user_id: string;
          channel: Database['public']['Enums']['notification_channel'];
          kind: string;
          title: string;
          body: string | null;
          entity_type: string | null;
          entity_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          recipient_user_id: string;
          channel?: Database['public']['Enums']['notification_channel'];
          kind: string;
          title: string;
          body?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          recipient_user_id?: string;
          channel?: Database['public']['Enums']['notification_channel'];
          kind?: string;
          title?: string;
          body?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_recipient_user_id_fkey';
            columns: ['recipient_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_branding: {
        Row: {
          organization_id: string;
          display_name: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          support_email: string | null;
          support_phone: string | null;
          hide_platform_branding: boolean;
          created_at: string;
          updated_at: string;
          logo_path: string | null;
          favicon_path: string | null;
        };
        Insert: {
          organization_id: string;
          display_name?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          hide_platform_branding?: boolean;
          created_at?: string;
          updated_at?: string;
          logo_path?: string | null;
          favicon_path?: string | null;
        };
        Update: {
          organization_id?: string;
          display_name?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          hide_platform_branding?: boolean;
          created_at?: string;
          updated_at?: string;
          logo_path?: string | null;
          favicon_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_branding_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: true;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_domains: {
        Row: {
          id: string;
          organization_id: string;
          hostname: string;
          is_primary: boolean;
          verification_token: string;
          verification_status: Database['public']['Enums']['domain_verification_status'];
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          hostname: string;
          is_primary?: boolean;
          verification_token?: string;
          verification_status?: Database['public']['Enums']['domain_verification_status'];
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          hostname?: string;
          is_primary?: boolean;
          verification_token?: string;
          verification_status?: Database['public']['Enums']['domain_verification_status'];
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_domains_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: true;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_settings: {
        Row: {
          organization_id: string;
          timezone: string;
          locale: string;
          checkin_required: boolean;
          checkout_mode: Database['public']['Enums']['checkout_mode'];
          gps_capture_enabled: boolean;
          ride_generation_horizon_days: number;
          driver_client_visibility_days: number;
          allow_contact_absence_reporting: boolean;
          absence_cutoff_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          timezone?: string;
          locale?: string;
          checkin_required?: boolean;
          checkout_mode?: Database['public']['Enums']['checkout_mode'];
          gps_capture_enabled?: boolean;
          ride_generation_horizon_days?: number;
          driver_client_visibility_days?: number;
          allow_contact_absence_reporting?: boolean;
          absence_cutoff_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          timezone?: string;
          locale?: string;
          checkin_required?: boolean;
          checkout_mode?: Database['public']['Enums']['checkout_mode'];
          gps_capture_enabled?: boolean;
          ride_generation_horizon_days?: number;
          driver_client_visibility_days?: number;
          allow_contact_absence_reporting?: boolean;
          absence_cutoff_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_settings_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: true;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_user_roles: {
        Row: {
          organization_user_id: string;
          role_id: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          organization_user_id: string;
          role_id: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Update: {
          organization_user_id?: string;
          role_id?: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_user_roles_organization_user_id_fkey';
            columns: ['organization_user_id'];
            isOneToOne: false;
            referencedRelation: 'organization_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_user_roles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_users: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          status: Database['public']['Enums']['membership_status'];
          invited_by: string | null;
          invited_at: string | null;
          joined_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          status?: Database['public']['Enums']['membership_status'];
          invited_by?: string | null;
          invited_at?: string | null;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          status?: Database['public']['Enums']['membership_status'];
          invited_by?: string | null;
          invited_at?: string | null;
          joined_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_users_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_users_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_users_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          legal_name: string | null;
          status: Database['public']['Enums']['org_status'];
          is_demo: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          legal_name?: string | null;
          status?: Database['public']['Enums']['org_status'];
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          legal_name?: string | null;
          status?: Database['public']['Enums']['org_status'];
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          key: string;
          category: string;
          description: string;
          is_assignable: boolean;
        };
        Insert: {
          key: string;
          category: string;
          description: string;
          is_assignable?: boolean;
        };
        Update: {
          key?: string;
          category?: string;
          description?: string;
          is_assignable?: boolean;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          key: string;
          name: string;
          limits: Json;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          limits?: Json;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          name?: string;
          limits?: Json;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          granted_by: string | null;
          granted_at: string;
          note: string | null;
        };
        Insert: {
          user_id: string;
          granted_by?: string | null;
          granted_at?: string;
          note?: string | null;
        };
        Update: {
          user_id?: string;
          granted_by?: string | null;
          granted_at?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'platform_admins_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'platform_admins_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          locale: string;
          status: Database['public']['Enums']['account_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          locale?: string;
          status?: Database['public']['Enums']['account_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          locale?: string;
          status?: Database['public']['Enums']['account_status'];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      ride_events: {
        Row: {
          id: string;
          organization_id: string;
          ride_id: string;
          event_type: Database['public']['Enums']['ride_event_type'];
          occurred_at: string;
          recorded_at: string;
          actor_user_id: string | null;
          actor_kind: Database['public']['Enums']['actor_kind'];
          source: Database['public']['Enums']['event_source'];
          nfc_tag_id: string | null;
          latitude: number | null;
          longitude: number | null;
          accuracy_m: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          ride_id: string;
          event_type: Database['public']['Enums']['ride_event_type'];
          occurred_at?: string;
          recorded_at?: string;
          actor_user_id?: string | null;
          actor_kind?: Database['public']['Enums']['actor_kind'];
          source?: Database['public']['Enums']['event_source'];
          nfc_tag_id?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          accuracy_m?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          ride_id?: string;
          event_type?: Database['public']['Enums']['ride_event_type'];
          occurred_at?: string;
          recorded_at?: string;
          actor_user_id?: string | null;
          actor_kind?: Database['public']['Enums']['actor_kind'];
          source?: Database['public']['Enums']['event_source'];
          nfc_tag_id?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          accuracy_m?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ride_events_actor_user_id_fkey';
            columns: ['actor_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_events_nfc_tag_fk';
            columns: ['nfc_tag_id'];
            isOneToOne: false;
            referencedRelation: 'nfc_tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_events_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_events_ride_id_fkey';
            columns: ['ride_id'];
            isOneToOne: false;
            referencedRelation: 'rides';
            referencedColumns: ['id'];
          },
        ];
      };
      ride_templates: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          name: string | null;
          pickup_location_id: string;
          destination_location_id: string;
          departure_time: string;
          days_of_week: number[];
          starts_on: string;
          ends_on: string | null;
          default_driver_id: string | null;
          default_vehicle_id: string | null;
          transport_requirements: Database['public']['Enums']['transport_requirement'][];
          status: Database['public']['Enums']['ride_template_status'];
          created_by: string | null;
          created_at: string;
          updated_at: string;
          trip_template_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          name?: string | null;
          pickup_location_id: string;
          destination_location_id: string;
          departure_time: string;
          days_of_week: number[];
          starts_on: string;
          ends_on?: string | null;
          default_driver_id?: string | null;
          default_vehicle_id?: string | null;
          transport_requirements?: Database['public']['Enums']['transport_requirement'][];
          status?: Database['public']['Enums']['ride_template_status'];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          trip_template_id?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          name?: string | null;
          pickup_location_id?: string;
          destination_location_id?: string;
          departure_time?: string;
          days_of_week?: number[];
          starts_on?: string;
          ends_on?: string | null;
          default_driver_id?: string | null;
          default_vehicle_id?: string | null;
          transport_requirements?: Database['public']['Enums']['transport_requirement'][];
          status?: Database['public']['Enums']['ride_template_status'];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          trip_template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ride_templates_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_templates_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_templates_default_driver_id_fkey';
            columns: ['default_driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_templates_default_vehicle_id_fkey';
            columns: ['default_vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_templates_destination_location_id_fkey';
            columns: ['destination_location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_templates_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_templates_pickup_location_id_fkey';
            columns: ['pickup_location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ride_templates_trip_template_id_fkey';
            columns: ['trip_template_id'];
            isOneToOne: false;
            referencedRelation: 'trip_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      rides: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          ride_template_id: string | null;
          scheduled_date: string;
          scheduled_pickup_time: string;
          scheduled_pickup_at: string;
          pickup_location_id: string;
          destination_location_id: string;
          driver_id: string | null;
          vehicle_id: string | null;
          status: Database['public']['Enums']['ride_status'];
          source: Database['public']['Enums']['ride_source'];
          is_modified: boolean;
          transport_requirements: Database['public']['Enums']['transport_requirement'][];
          absence_reason: Database['public']['Enums']['absence_reason'] | null;
          cancellation_reason: string | null;
          notes: string | null;
          checked_in_at: string | null;
          started_at: string | null;
          arrived_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          trip_id: string | null;
          pickup_stop_id: string | null;
          dropoff_stop_id: string | null;
          checked_in_method: Database['public']['Enums']['event_source'] | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          ride_template_id?: string | null;
          scheduled_date: string;
          scheduled_pickup_time: string;
          scheduled_pickup_at: string;
          pickup_location_id: string;
          destination_location_id: string;
          driver_id?: string | null;
          vehicle_id?: string | null;
          status?: Database['public']['Enums']['ride_status'];
          source?: Database['public']['Enums']['ride_source'];
          is_modified?: boolean;
          transport_requirements?: Database['public']['Enums']['transport_requirement'][];
          absence_reason?: Database['public']['Enums']['absence_reason'] | null;
          cancellation_reason?: string | null;
          notes?: string | null;
          checked_in_at?: string | null;
          started_at?: string | null;
          arrived_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          trip_id?: string | null;
          pickup_stop_id?: string | null;
          dropoff_stop_id?: string | null;
          checked_in_method?: Database['public']['Enums']['event_source'] | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          client_id?: string;
          ride_template_id?: string | null;
          scheduled_date?: string;
          scheduled_pickup_time?: string;
          scheduled_pickup_at?: string;
          pickup_location_id?: string;
          destination_location_id?: string;
          driver_id?: string | null;
          vehicle_id?: string | null;
          status?: Database['public']['Enums']['ride_status'];
          source?: Database['public']['Enums']['ride_source'];
          is_modified?: boolean;
          transport_requirements?: Database['public']['Enums']['transport_requirement'][];
          absence_reason?: Database['public']['Enums']['absence_reason'] | null;
          cancellation_reason?: string | null;
          notes?: string | null;
          checked_in_at?: string | null;
          started_at?: string | null;
          arrived_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          trip_id?: string | null;
          pickup_stop_id?: string | null;
          dropoff_stop_id?: string | null;
          checked_in_method?: Database['public']['Enums']['event_source'] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rides_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_destination_location_id_fkey';
            columns: ['destination_location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_dropoff_stop_id_fkey';
            columns: ['dropoff_stop_id'];
            isOneToOne: false;
            referencedRelation: 'trip_stops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_pickup_location_id_fkey';
            columns: ['pickup_location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_pickup_stop_id_fkey';
            columns: ['pickup_stop_id'];
            isOneToOne: false;
            referencedRelation: 'trip_stops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_ride_template_id_fkey';
            columns: ['ride_template_id'];
            isOneToOne: false;
            referencedRelation: 'ride_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rides_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_key: string;
        };
        Insert: {
          role_id: string;
          permission_key: string;
        };
        Update: {
          role_id?: string;
          permission_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_permission_key_fkey';
            columns: ['permission_key'];
            isOneToOne: false;
            referencedRelation: 'permissions';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      roles: {
        Row: {
          id: string;
          organization_id: string | null;
          key: string;
          name: string;
          description: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          key: string;
          name: string;
          description?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          key?: string;
          name?: string;
          description?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          status: Database['public']['Enums']['subscription_status'];
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          status?: Database['public']['Enums']['subscription_status'];
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          plan_id?: string;
          status?: Database['public']['Enums']['subscription_status'];
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: true;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      support_access_grants: {
        Row: {
          id: string;
          organization_id: string;
          granted_to_user_id: string;
          granted_by_user_id: string;
          reason: string;
          expires_at: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          granted_to_user_id: string;
          granted_by_user_id: string;
          reason: string;
          expires_at: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          granted_to_user_id?: string;
          granted_by_user_id?: string;
          reason?: string;
          expires_at?: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_access_grants_granted_by_user_id_fkey';
            columns: ['granted_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_access_grants_granted_to_user_id_fkey';
            columns: ['granted_to_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_access_grants_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      tag_assignments: {
        Row: {
          id: string;
          organization_id: string;
          nfc_tag_id: string;
          client_id: string;
          assigned_at: string;
          assigned_by: string | null;
          unassigned_at: string | null;
          unassigned_by: string | null;
          reason: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          nfc_tag_id: string;
          client_id: string;
          assigned_at?: string;
          assigned_by?: string | null;
          unassigned_at?: string | null;
          unassigned_by?: string | null;
          reason?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          nfc_tag_id?: string;
          client_id?: string;
          assigned_at?: string;
          assigned_by?: string | null;
          unassigned_at?: string | null;
          unassigned_by?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tag_assignments_assigned_by_fkey';
            columns: ['assigned_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tag_assignments_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tag_assignments_nfc_tag_id_fkey';
            columns: ['nfc_tag_id'];
            isOneToOne: false;
            referencedRelation: 'nfc_tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tag_assignments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tag_assignments_unassigned_by_fkey';
            columns: ['unassigned_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tag_scan_attempts: {
        Row: {
          id: number;
          user_id: string | null;
          outcome: Database['public']['Enums']['checkin_outcome'];
          attempted_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          outcome: Database['public']['Enums']['checkin_outcome'];
          attempted_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string | null;
          outcome?: Database['public']['Enums']['checkin_outcome'];
          attempted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tag_scan_attempts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_stops: {
        Row: {
          id: string;
          organization_id: string;
          trip_id: string;
          location_id: string;
          sequence: number;
          kind: Database['public']['Enums']['stop_kind'];
          planned_arrival_time: string | null;
          planned_arrival_at: string | null;
          arrived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          trip_id: string;
          location_id: string;
          sequence: number;
          kind?: Database['public']['Enums']['stop_kind'];
          planned_arrival_time?: string | null;
          planned_arrival_at?: string | null;
          arrived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          trip_id?: string;
          location_id?: string;
          sequence?: number;
          kind?: Database['public']['Enums']['stop_kind'];
          planned_arrival_time?: string | null;
          planned_arrival_at?: string | null;
          arrived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_stops_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_stops_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_stops_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_templates: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          departure_time: string;
          days_of_week: number[];
          starts_on: string;
          ends_on: string | null;
          default_driver_id: string | null;
          default_vehicle_id: string | null;
          status: Database['public']['Enums']['ride_template_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          departure_time: string;
          days_of_week: number[];
          starts_on: string;
          ends_on?: string | null;
          default_driver_id?: string | null;
          default_vehicle_id?: string | null;
          status?: Database['public']['Enums']['ride_template_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          departure_time?: string;
          days_of_week?: number[];
          starts_on?: string;
          ends_on?: string | null;
          default_driver_id?: string | null;
          default_vehicle_id?: string | null;
          status?: Database['public']['Enums']['ride_template_status'];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trip_templates_default_driver_id_fkey';
            columns: ['default_driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_templates_default_vehicle_id_fkey';
            columns: ['default_vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_templates_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          id: string;
          organization_id: string;
          name: string | null;
          scheduled_date: string;
          driver_id: string | null;
          vehicle_id: string | null;
          status: Database['public']['Enums']['trip_status'];
          planned_start_time: string;
          planned_start_at: string;
          planned_end_at: string;
          started_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name?: string | null;
          scheduled_date: string;
          driver_id?: string | null;
          vehicle_id?: string | null;
          status?: Database['public']['Enums']['trip_status'];
          planned_start_time: string;
          planned_start_at: string;
          planned_end_at: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string | null;
          scheduled_date?: string;
          driver_id?: string | null;
          vehicle_id?: string | null;
          status?: Database['public']['Enums']['trip_status'];
          planned_start_time?: string;
          planned_start_at?: string;
          planned_end_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      usage_metrics: {
        Row: {
          id: string;
          organization_id: string;
          metric_key: string;
          period_start: string;
          value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          metric_key: string;
          period_start: string;
          value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          metric_key?: string;
          period_start?: string;
          value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_metrics_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicles: {
        Row: {
          id: string;
          organization_id: string;
          license_plate: string;
          make: string | null;
          model: string | null;
          vehicle_type: string | null;
          seats: number;
          wheelchair_positions: number;
          is_wheelchair_accessible: boolean;
          status: Database['public']['Enums']['vehicle_status'];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          license_plate: string;
          make?: string | null;
          model?: string | null;
          vehicle_type?: string | null;
          seats?: number;
          wheelchair_positions?: number;
          is_wheelchair_accessible?: boolean;
          status?: Database['public']['Enums']['vehicle_status'];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          license_plate?: string;
          make?: string | null;
          model?: string | null;
          vehicle_type?: string | null;
          seats?: number;
          wheelchair_positions?: number;
          is_wheelchair_accessible?: boolean;
          status?: Database['public']['Enums']['vehicle_status'];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      branding_for_host: {
        Args: {
          p_host: string;
        };
        Returns: {
          display_name: string | null;
          logo_path: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          hide_platform_branding: boolean | null;
        }[];
      };
      checkin_by_tag_token: {
        Args: {
          p_token_hash: string;
          p_source?: string;
        };
        Returns: {
          outcome: Database['public']['Enums']['checkin_outcome'] | null;
          ride_id: string | null;
          client_first_name: string | null;
          client_last_name: string | null;
          occurred_at: string | null;
        }[];
      };
    };
    Enums: {
      absence_reason: 'NOT_HOME' | 'CANCELLED_BY_CLIENT' | 'ILL' | 'NO_ACCESS' | 'OTHER';
      account_status: 'ACTIVE' | 'SUSPENDED';
      actor_kind: 'DRIVER' | 'PLANNER' | 'SYSTEM' | 'PORTAL' | 'PLATFORM';
      change_request_kind:
        'ABSENCE' | 'TIME_CHANGE' | 'DESTINATION_CHANGE' | 'CANCEL' | 'OTHER';
      change_request_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
      checkin_outcome:
        | 'CHECKED_IN'
        | 'ALREADY_CHECKED_IN'
        | 'NO_ACTIVE_RIDE'
        | 'NO_ACCESS'
        | 'UNKNOWN_TAG'
        | 'NOT_ALLOWED'
        | 'RATE_LIMITED';
      checkout_mode: 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
      client_status: 'ACTIVE' | 'INACTIVE';
      domain_verification_status: 'PENDING' | 'VERIFIED' | 'FAILED';
      driver_status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
      event_source: 'NFC' | 'QR' | 'MANUAL' | 'SYSTEM';
      geocode_status: 'PENDING' | 'RESOLVED' | 'FAILED' | 'MANUAL';
      location_kind:
        | 'HOME'
        | 'SCHOOL'
        | 'DAY_CARE'
        | 'CARE_FACILITY'
        | 'WORK'
        | 'STATION'
        | 'HOSPITAL'
        | 'OTHER';
      membership_status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
      notification_channel: 'IN_APP' | 'EMAIL' | 'PUSH';
      org_status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
      requester_kind: 'CLIENT' | 'CONTACT' | 'CARE_ORG';
      ride_event_type:
        | 'CREATED'
        | 'DRIVER_ASSIGNED'
        | 'DRIVER_UNASSIGNED'
        | 'VEHICLE_ASSIGNED'
        | 'DRIVER_EN_ROUTE'
        | 'DRIVER_ARRIVED'
        | 'CLIENT_CHECKED_IN'
        | 'CLIENT_CHECKED_OUT'
        | 'TRIP_STARTED'
        | 'ARRIVED'
        | 'COMPLETED'
        | 'CLIENT_ABSENT'
        | 'CANCELLED'
        | 'PROBLEM_REPORTED'
        | 'NOTE_ADDED'
        | 'RESCHEDULED';
      ride_source: 'TEMPLATE' | 'MANUAL';
      ride_status:
        | 'SCHEDULED'
        | 'DRIVER_ASSIGNED'
        | 'DRIVER_EN_ROUTE'
        | 'DRIVER_ARRIVED'
        | 'CLIENT_CHECKED_IN'
        | 'TRIP_STARTED'
        | 'ARRIVED'
        | 'COMPLETED'
        | 'CLIENT_ABSENT'
        | 'CANCELLED'
        | 'PROBLEM';
      ride_template_status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
      stop_kind: 'PICKUP' | 'DROPOFF' | 'BOTH';
      subscription_status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
      tag_status: 'UNASSIGNED' | 'ACTIVE' | 'INACTIVE' | 'LOST' | 'REPLACED';
      transport_requirement:
        | 'WHEELCHAIR'
        | 'WALKER'
        | 'ASSISTANCE_TO_DOOR'
        | 'SEATBELT_SUPPORT'
        | 'COMPANION_SEAT';
      trip_status: 'PLANNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
      vehicle_status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    };
    CompositeTypes: Record<string, never>;
  };
}

/** Convenience aliases so features do not repeat the deep index type. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
