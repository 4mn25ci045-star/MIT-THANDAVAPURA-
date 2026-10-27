export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      admin_attempts: {
        Row: {
          blocked_until: string | null;
          failures: number;
          user_id: string;
          window_start: string;
        };
        Insert: {
          blocked_until?: string | null;
          failures?: number;
          user_id: string;
          window_start?: string;
        };
        Update: {
          blocked_until?: string | null;
          failures?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      admin_credentials: {
        Row: {
          id: number;
          salt: string;
          verifier: string;
          version: number;
        };
        Insert: {
          id: number;
          salt: string;
          verifier: string;
          version?: number;
        };
        Update: {
          id?: number;
          salt?: string;
          verifier?: string;
          version?: number;
        };
        Relationships: [];
      };
      admin_sessions: {
        Row: {
          credential_version: number;
          expires_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          credential_version: number;
          expires_at: string;
          id?: string;
          user_id: string;
        };
        Update: {
          credential_version?: number;
          expires_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      approved_personnel: {
        Row: {
          email: string | null;
          id: string;
          phone: string | null;
        };
        Insert: {
          email?: string | null;
          id?: string;
          phone?: string | null;
        };
        Update: {
          email?: string | null;
          id?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      bus_positions: {
        Row: {
          eta_seconds: number | null;
          eta_target_latitude: number | null;
          eta_target_longitude: number | null;
          fuel_percent: number | null;
          heading: number | null;
          ignition_on: boolean | null;
          latitude: number;
          longitude: number;
          recorded_at: string;
          route_id: string;
          speed_mps: number | null;
        };
        Insert: {
          eta_seconds?: number | null;
          eta_target_latitude?: number | null;
          eta_target_longitude?: number | null;
          fuel_percent?: number | null;
          heading?: number | null;
          ignition_on?: boolean | null;
          latitude: number;
          longitude: number;
          recorded_at: string;
          route_id: string;
          speed_mps?: number | null;
        };
        Update: {
          eta_seconds?: number | null;
          eta_target_latitude?: number | null;
          eta_target_longitude?: number | null;
          fuel_percent?: number | null;
          heading?: number | null;
          ignition_on?: boolean | null;
          latitude?: number;
          longitude?: number;
          recorded_at?: string;
          route_id?: string;
          speed_mps?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "bus_positions_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: true;
            referencedRelation: "bus_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      bus_gps_devices: {
        Row: {
          created_at: string;
          last_checked_at: string | null;
          last_error_code: string | null;
          last_success_at: string | null;
          provider: string;
          provider_device_id: string;
          route_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          last_checked_at?: string | null;
          last_error_code?: string | null;
          last_success_at?: string | null;
          provider: string;
          provider_device_id: string;
          route_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          last_checked_at?: string | null;
          last_error_code?: string | null;
          last_success_at?: string | null;
          provider?: string;
          provider_device_id?: string;
          route_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bus_gps_devices_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: true;
            referencedRelation: "bus_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      bus_routes: {
        Row: {
          bus_number: string;
          default_color: string;
          destination: string | null;
          direction: string | null;
          driver_name: string | null;
          driver_phone: string | null;
          geometry: Json | null;
          id: string;
          imei: string;
          origin: string | null;
          route_number: string;
          stops: Json;
          student_visible: boolean;
        };
        Insert: {
          bus_number: string;
          default_color?: string;
          destination?: string | null;
          direction?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          geometry?: Json | null;
          id?: string;
          imei: string;
          origin?: string | null;
          route_number: string;
          stops?: Json;
          student_visible?: boolean;
        };
        Update: {
          bus_number?: string;
          default_color?: string;
          destination?: string | null;
          direction?: string | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          geometry?: Json | null;
          id?: string;
          imei?: string;
          origin?: string | null;
          route_number?: string;
          stops?: Json;
          student_visible?: boolean;
        };
        Relationships: [];
      };
      bus_timetable: {
        Row: {
          arrival_time: string | null;
          departure_time: string;
          direction: string;
          id: string;
          pickup_stop: string;
          published: boolean;
          route_id: string;
          weekday: number;
        };
        Insert: {
          arrival_time?: string | null;
          departure_time: string;
          direction?: string;
          id?: string;
          pickup_stop: string;
          published?: boolean;
          route_id: string;
          weekday: number;
        };
        Update: {
          arrival_time?: string | null;
          departure_time?: string;
          direction?: string;
          id?: string;
          pickup_stop?: string;
          published?: boolean;
          route_id?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "bus_timetable_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "bus_routes";
            referencedColumns: ["id"];
          },
        ];
      };
      college_updates: {
        Row: {
          body: string;
          id: string;
          published: boolean;
          published_at: string;
          title: string;
        };
        Insert: {
          body: string;
          id?: string;
          published?: boolean;
          published_at?: string;
          title: string;
        };
        Update: {
          body?: string;
          id?: string;
          published?: boolean;
          published_at?: string;
          title?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          alert_distance_m: number;
          display_name: string;
          id: string;
        };
        Insert: {
          alert_distance_m?: number;
          display_name?: string;
          id: string;
        };
        Update: {
          alert_distance_m?: number;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      transport_issues: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          id: string;
          route_id: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description: string;
          id?: string;
          route_id?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          route_id?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transport_issues_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "bus_routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transport_issues_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          role: string;
          user_id: string;
        };
        Insert: {
          role: string;
          user_id: string;
        };
        Update: {
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      voice_messages: {
        Row: {
          created_at: string;
          id: string;
          route_id: string;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          route_id: string;
          storage_path: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          route_id?: string;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voice_messages_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "bus_routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_personnel: { Args: never; Returns: boolean };
      reserve_admin_attempt: { Args: { p_user: string }; Returns: boolean };
      student_bus_feed: { Args: never; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
