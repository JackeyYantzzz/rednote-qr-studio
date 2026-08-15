export type CampaignStatus = "active" | "inactive";
export type PublishJobStatus =
  | "pending"
  | "approved"
  | "preparing"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";
export type PublishVisibility = "private" | "public";
export type FastPublishEventName =
  | "fast_page_view"
  | "fast_share_clicked"
  | "fast_share_completed"
  | "fast_share_cancelled"
  | "fast_share_failed";

export interface FastPublishContent {
  title: string;
  body: string;
  tags: string[];
}

export interface Campaign {
  id: string;
  slug: string;
  name: string;
  brand_name: string;
  product_name: string;
  product_description: string;
  brand_guide: string;
  default_tone: string;
  default_keywords: string[];
  prohibited_phrases: string[];
  allowed_post_types: string[];
  max_image_count: number;
  fast_publish_enabled: boolean;
  fast_publish_images: string[];
  fast_publish_content: FastPublishContent | null;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  campaign_id: string;
  file_url: string;
  storage_path: string;
  thumbnail_url: string | null;
  name: string;
  description: string;
  category: string;
  keywords: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithAssets extends Campaign {
  assets: Asset[];
}

export interface GeneratedPost {
  titleOptions: [string, string, string];
  selectedTitle: string;
  body: string;
  tags: string[];
  fullPost: string;
}

export interface Generation {
  id: string;
  campaign_id: string;
  selected_asset_ids: string[];
  user_input: Record<string, unknown>;
  generated_content: GeneratedPost;
  edited_content: GeneratedPost | null;
  created_at: string;
  campaign?: Pick<Campaign, "name" | "brand_name" | "product_name">;
}

export interface PublishJob {
  id: string;
  generation_id: string;
  status: PublishJobStatus;
  title: string;
  content: string;
  tags: string[];
  image_urls: string[];
  visibility: PublishVisibility;
  schedule_at: string | null;
  is_original: boolean;
  attempt_count: number;
  result: unknown;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface FastPublishEvent {
  id: string;
  campaign_id: string;
  event_name: FastPublishEventName;
  session_id: string;
  created_at: string;
}

export interface FastPublishAnalytics {
  campaign_id: string;
  campaign_name: string;
  campaign_slug: string;
  enabled: boolean;
  page_views: number;
  share_clicks: number;
  share_completed: number;
  share_cancelled: number;
  share_failed: number;
}

export interface GenerationQuotaStatus {
  allowed: boolean;
  usedCount: number;
  limitCount: number;
  remaining: number;
  locked: boolean;
  updatedAt: string;
  lastResetAt?: string | null;
  lastResetBy?: string | null;
}
