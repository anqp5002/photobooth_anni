/** Kiểu dữ liệu theo "Hợp đồng API" của MEGAPLAN_r1.md. */

export type Visibility = 'private' | 'link' | 'public';

export type Vehicle = 'motorbike' | 'train' | 'bus' | 'ferry' | 'ship' | 'plane' | 'car' | 'none';

export type SegmentKind = 'straight' | 'road';

export interface Country {
  code: string;
  name: string;
}

export interface Weather {
  tempC: number;
  icon: string;
}

export interface MediaFlags {
  blurry: boolean;
  nearDuplicate: boolean;
  hidden: boolean;
}

export interface Media {
  id: string;
  type: 'photo' | 'video';
  order: number;
  orig: string;
  lg: string;
  sm: string;
  width: number;
  height: number;
  duration: number | null;
  flags: MediaFlags;
}

export interface StepLocation {
  lat: number;
  lon: number;
  name: string;
  country: Country;
}

export interface Step {
  id: string;
  slug: string;
  name: string;
  description: string;
  startedAt: string;
  location: StepLocation;
  weather: Weather | null;
  comments: number;
  likes: number;
  media: Media[];
  draft: { name: string; description: string } | null;
}

export interface Segment {
  fromStepId: string;
  toStepId: string;
  vehicle: Vehicle;
  kind: SegmentKind;
  polyline: string;
}

export interface TripAuthor {
  username: string;
  displayName: string;
  avatar: string;
}

export interface TripCover {
  orig: string;
  lg: string;
  sm: string;
}

export interface Trip {
  id: string;
  name: string;
  slug: string;
  startedAt: string;
  endedAt: string | null;
  timezone: string;
  km: number;
  views: number;
  likes: number;
  visibility: Visibility;
  cover: TripCover;
  author: TripAuthor;
  countries: Country[];
  stepsTotal: number;
  steps: Step[];
  segments: Segment[];
  nextOffset: number | null;
}

export interface TripSummary {
  id: string;
  slug: string;
  name: string;
  cover: { sm: string; lg: string };
  startedAt: string;
  endedAt: string | null;
  steps: number;
  km: number;
  countries: number;
}

export interface UserProfile {
  username: string;
  displayName: string;
  avatar: string;
  countryCount: number;
  trips: TripSummary[];
}

export interface StepsPage {
  steps: Step[];
  nextOffset: number | null;
}
