create extension if not exists "uuid-ossp";

-- Create profiles table (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  bio text,
  website text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create user_roles table
create table user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  role text not null default 'user', -- 'user', 'editor', 'admin'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- Create videos table
create table videos (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  url text not null,
  thumbnail_url text,
  duration integer, -- in seconds
  created_by uuid references auth.users not null,
  category text,
  tags text[],
  is_public boolean default true,
  view_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create panels table
create table panels (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  location text,
  is_virtual boolean default false,
  virtual_url text,
  max_participants integer,
  created_by uuid references auth.users not null,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create panel_participants junction table
create table panel_participants (
  id uuid primary key default uuid_generate_v4(),
  panel_id uuid references panels not null,
  user_id uuid references auth.users not null,
  role text not null, -- 'moderator', 'panelist', 'attendee'
  created_at timestamptz default now(),
  unique(panel_id, user_id)
);

-- Create modules table
create table modules (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  content jsonb, -- Structured content with sections, lessons, etc.
  thumbnail_url text,
  created_by uuid references auth.users not null,
  category text,
  tags text[],
  is_public boolean default true,
  estimated_hours integer, -- Estimated completion time in hours
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create user_module_progress table to track progress
create table user_module_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  module_id uuid references modules not null,
  progress numeric default 0, -- Percentage of completion (0-100)
  last_accessed_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, module_id)
);

-- Create clinics table
create table clinics (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  location text,
  address text,
  city text,
  state text,
  zip text,
  country text,
  phone text,
  email text,
  website text,
  operating_hours jsonb, -- Structured JSON for hours of operation
  services text[],
  created_by uuid references auth.users not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create clinic_staff junction table
create table clinic_staff (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references clinics not null,
  user_id uuid references auth.users not null,
  role text not null, -- 'doctor', 'nurse', 'admin', 'receptionist'
  specialization text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(clinic_id, user_id)
);

-- Create events table
create table events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  timezone text,
  location text,
  address text,
  city text,
  state text,
  zip text,
  country text,
  is_virtual boolean default false,
  virtual_url text,
  max_participants integer,
  thumbnail_url text,
  created_by uuid references auth.users not null,
  category text,
  tags text[],
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create event_participants junction table
create table event_participants (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events not null,
  user_id uuid references auth.users not null,
  role text not null, -- 'organizer', 'speaker', 'attendee'
  registration_status text default 'registered', -- 'registered', 'attended', 'canceled'
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(event_id, user_id)
);

-- Create tickets table
create table tickets (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text not null default 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  priority text default 'medium', -- 'low', 'medium', 'high', 'urgent'
  category text,
  assigned_to uuid references auth.users,
  created_by uuid references auth.users not null,
  related_entity_type text, -- 'event', 'panel', 'module', 'clinic', 'video', etc.
  related_entity_id uuid, -- ID of the related entity
  due_date timestamptz,
  resolution_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create ticket_comments table
create table ticket_comments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets not null,
  comment text not null,
  user_id uuid references auth.users not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create ticket_history table to track changes
create table ticket_history (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references tickets not null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users not null,
  created_at timestamptz default now()
);

-- Row Level Security (RLS) Policies

-- Profiles table policies
alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Everyone can read public profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using (true);

-- User roles policies
alter table user_roles enable row level security;

create policy "Users can view their own role"
  on user_roles for select
  using (auth.uid() = user_id);

create policy "Admins can view all roles"
  on user_roles for select
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update roles"
  on user_roles for update
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can insert roles"
  on user_roles for insert
  with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Videos table policies
alter table videos enable row level security;

create policy "Public videos are viewable by everyone"
  on videos for select
  using (is_public = true);

create policy "Users can view their own videos"
  on videos for select
  using (auth.uid() = created_by);

create policy "Users can insert their own videos"
  on videos for insert
  with check (auth.uid() = created_by);

create policy "Users can update their own videos"
  on videos for update
  using (auth.uid() = created_by);

create policy "Admins can manage all videos"
  on videos for all
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Add similar policies for other tables
-- (panels, modules, clinics, events, tickets)

-- Functions and triggers

-- Function to update timestamps
create or replace function update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_profiles_timestamp
before update on profiles
for each row execute procedure update_timestamp();

create trigger update_user_roles_timestamp
before update on user_roles
for each row execute procedure update_timestamp();

create trigger update_videos_timestamp
before update on videos
for each row execute procedure update_timestamp();

create trigger update_panels_timestamp
before update on panels
for each row execute procedure update_timestamp();

create trigger update_modules_timestamp
before update on modules
for each row execute procedure update_timestamp();

create trigger update_user_module_progress_timestamp
before update on user_module_progress
for each row execute procedure update_timestamp();

create trigger update_clinics_timestamp
before update on clinics
for each row execute procedure update_timestamp();

create trigger update_clinic_staff_timestamp
before update on clinic_staff
for each row execute procedure update_timestamp();

create trigger update_events_timestamp
before update on events
for each row execute procedure update_timestamp();

create trigger update_event_participants_timestamp
before update on event_participants
for each row execute procedure update_timestamp();

create trigger update_tickets_timestamp
before update on tickets
for each row execute procedure update_timestamp();

create trigger update_ticket_comments_timestamp
before update on ticket_comments
for each row execute procedure update_timestamp();

-- Function to handle new user registration
create or replace function handle_new_user()
returns trigger as $$
begin
  -- Create a profile for the new user
  insert into profiles (id, email)
  values (new.id, new.email);
  
  -- Assign default role
  insert into user_roles (user_id, role)
  values (new.id, 'user');
  
  return new;
end;
