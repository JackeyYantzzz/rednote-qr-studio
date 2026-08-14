import "server-only";

import { isDemoMode } from "@/lib/config";
import { getDemoStore } from "@/lib/demo-data";
import { summarizeFastPublishEvents } from "@/lib/fast-publish";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { CampaignInput, GeneratedPostInput } from "@/lib/schemas";
import type {
  Asset,
  Campaign,
  CampaignWithAssets,
  FastPublishAnalytics,
  FastPublishEvent,
  FastPublishEventName,
  Generation,
  PublishJob,
  PublishJobStatus,
} from "@/types/database";

function now() {
  return new Date().toISOString();
}

function sortAssets(assets: Asset[]) {
  return [...assets].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
  );
}

function castCampaignWithAssets(value: unknown): CampaignWithAssets {
  const campaign = value as CampaignWithAssets;
  return {
    ...campaign,
    fast_publish_enabled: Boolean(campaign.fast_publish_enabled),
    fast_publish_images: Array.isArray(campaign.fast_publish_images)
      ? campaign.fast_publish_images
      : [],
    fast_publish_content: campaign.fast_publish_content ?? null,
    assets: sortAssets(campaign.assets ?? []),
  };
}

export async function listCampaigns(): Promise<CampaignWithAssets[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    return store.campaigns.map((campaign) => ({
      ...campaign,
      assets: sortAssets(store.assets.filter((asset) => asset.campaign_id === campaign.id)),
    }));
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, assets(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(castCampaignWithAssets);
}

export async function getCampaignBySlug(
  slug: string,
  activeOnly = true,
): Promise<CampaignWithAssets | null> {
  if (isDemoMode()) {
    const campaign = (await listCampaigns()).find((item) => item.slug === slug);
    if (!campaign || (activeOnly && campaign.status !== "active")) return null;
    return {
      ...campaign,
      assets: campaign.assets.filter((asset) => !activeOnly || asset.is_active),
    };
  }
  const supabase = createServiceSupabaseClient();
  let query = supabase.from("campaigns").select("*, assets(*)").eq("slug", slug);
  if (activeOnly) query = query.eq("status", "active");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const campaign = castCampaignWithAssets(data);
  return {
    ...campaign,
    assets: campaign.assets.filter((asset) => !activeOnly || asset.is_active),
  };
}

export async function getCampaignById(id: string): Promise<CampaignWithAssets | null> {
  if (isDemoMode()) {
    return (await listCampaigns()).find((campaign) => campaign.id === id) ?? null;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, assets(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? castCampaignWithAssets(data) : null;
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  if (isDemoMode()) {
    const store = getDemoStore();
    if (store.campaigns.some((campaign) => campaign.slug === input.slug)) {
      throw new Error("Campaign slug already exists.");
    }
    const campaign: Campaign = {
      id: crypto.randomUUID(),
      ...input,
      created_at: now(),
      updated_at: now(),
    };
    store.campaigns.unshift(campaign);
    return campaign;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function updateCampaign(
  id: string,
  input: Partial<CampaignInput>,
): Promise<Campaign> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const index = store.campaigns.findIndex((campaign) => campaign.id === id);
    if (index < 0) throw new Error("Campaign not found.");
    const updated = { ...store.campaigns[index], ...input, updated_at: now() };
    store.campaigns[index] = updated;
    return updated;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ ...input, updated_at: now() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function createAsset(
  input: Omit<Asset, "id" | "created_at" | "updated_at">,
): Promise<Asset> {
  if (isDemoMode()) {
    const asset: Asset = {
      id: crypto.randomUUID(),
      ...input,
      created_at: now(),
      updated_at: now(),
    };
    getDemoStore().assets.push(asset);
    return asset;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.from("assets").insert(input).select("*").single();
  if (error) throw error;
  return data as Asset;
}

export async function updateAsset(
  id: string,
  input: Partial<Omit<Asset, "id" | "campaign_id" | "created_at" | "updated_at">>,
): Promise<Asset> {
  if (isDemoMode()) {
    const store = getDemoStore();
    const index = store.assets.findIndex((asset) => asset.id === id);
    if (index < 0) throw new Error("Asset not found.");
    const updated = { ...store.assets[index], ...input, updated_at: now() };
    store.assets[index] = updated;
    return updated;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ ...input, updated_at: now() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Asset;
}

export async function getAssetsByIds(
  campaignId: string,
  ids: string[],
): Promise<Asset[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    return ids
      .map((id) =>
        store.assets.find(
          (asset) => asset.id === id && asset.campaign_id === campaignId && asset.is_active,
        ),
      )
      .filter((asset): asset is Asset => Boolean(asset));
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .in("id", ids);
  if (error) throw error;
  const byId = new Map((data as Asset[]).map((asset) => [asset.id, asset]));
  return ids.map((id) => byId.get(id)).filter((asset): asset is Asset => Boolean(asset));
}

export async function getAssetById(id: string): Promise<Asset | null> {
  if (isDemoMode()) {
    return getDemoStore().assets.find((asset) => asset.id === id && asset.is_active) ?? null;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as Asset | null) ?? null;
}

export async function saveGeneration(input: {
  campaignId: string;
  assetIds: string[];
  userInput: Record<string, unknown>;
  generatedContent: GeneratedPostInput;
}): Promise<Generation> {
  const record = {
    campaign_id: input.campaignId,
    selected_asset_ids: input.assetIds,
    user_input: input.userInput,
    generated_content: input.generatedContent,
    edited_content: null,
  };
  if (isDemoMode()) {
    const generation: Generation = {
      id: crypto.randomUUID(),
      ...record,
      generated_content: input.generatedContent as Generation["generated_content"],
      created_at: now(),
    };
    getDemoStore().generations.unshift(generation);
    return generation;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("generations")
    .insert(record)
    .select("*")
    .single();
  if (error) throw error;
  return data as Generation;
}

export async function listGenerations(): Promise<Generation[]> {
  if (isDemoMode()) {
    const store = getDemoStore();
    return store.generations.map((generation) => ({
      ...generation,
      campaign: store.campaigns.find((campaign) => campaign.id === generation.campaign_id),
    }));
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("generations")
    .select("*, campaign:campaigns(name, brand_name, product_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as Generation[];
}

export async function getGeneration(id: string): Promise<Generation | null> {
  if (isDemoMode()) {
    return getDemoStore().generations.find((generation) => generation.id === id) ?? null;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Generation | null) ?? null;
}

export async function createPublishJob(
  input: Omit<
    PublishJob,
    | "id"
    | "status"
    | "attempt_count"
    | "result"
    | "error_message"
    | "created_at"
    | "started_at"
    | "completed_at"
  >,
): Promise<PublishJob> {
  const record = {
    ...input,
    status: "pending" as const,
    attempt_count: 0,
    result: null,
    error_message: null,
    started_at: null,
    completed_at: null,
  };
  if (isDemoMode()) {
    const job: PublishJob = { id: crypto.randomUUID(), ...record, created_at: now() };
    getDemoStore().publishJobs.unshift(job);
    return job;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("publish_jobs")
    .insert(record)
    .select("*")
    .single();
  if (error) throw error;
  return data as PublishJob;
}

export async function listPublishJobs(): Promise<PublishJob[]> {
  if (isDemoMode()) return [...getDemoStore().publishJobs];
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("publish_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PublishJob[];
}

export async function getPublishJob(id: string): Promise<PublishJob | null> {
  if (isDemoMode()) {
    return getDemoStore().publishJobs.find((job) => job.id === id) ?? null;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("publish_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PublishJob | null) ?? null;
}

export async function setPublishJobStatus(
  id: string,
  status: PublishJobStatus,
): Promise<PublishJob> {
  const patch: Partial<PublishJob> = { status };
  if (status === "approved") {
    patch.error_message = null;
    patch.completed_at = null;
  }
  if (status === "cancelled") patch.completed_at = now();

  if (isDemoMode()) {
    const store = getDemoStore();
    const index = store.publishJobs.findIndex((job) => job.id === id);
    if (index < 0) throw new Error("Publish job not found.");
    const updated = { ...store.publishJobs[index], ...patch };
    store.publishJobs[index] = updated;
    return updated;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("publish_jobs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as PublishJob;
}

export async function recordFastPublishEvent(input: {
  campaignId: string;
  eventName: FastPublishEventName;
  sessionId: string;
}): Promise<FastPublishEvent> {
  const record = {
    campaign_id: input.campaignId,
    event_name: input.eventName,
    session_id: input.sessionId,
  };
  if (isDemoMode()) {
    const event: FastPublishEvent = {
      id: crypto.randomUUID(),
      ...record,
      created_at: now(),
    };
    getDemoStore().fastPublishEvents.push(event);
    return event;
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("fast_publish_events")
    .insert(record)
    .select("*")
    .single();
  if (error) throw error;
  return data as FastPublishEvent;
}

export async function listFastPublishAnalytics(): Promise<
  FastPublishAnalytics[]
> {
  const campaigns = await listCampaigns();
  if (isDemoMode()) {
    return summarizeFastPublishEvents(
      campaigns,
      getDemoStore().fastPublishEvents,
    );
  }
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("fast_publish_events")
    .select("campaign_id, event_name")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) throw error;
  return summarizeFastPublishEvents(
    campaigns,
    (data ?? []) as Pick<
      FastPublishEvent,
      "campaign_id" | "event_name"
    >[],
  );
}
