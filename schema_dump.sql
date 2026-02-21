--
-- PostgreSQL database dump
--

-- Dumped from database version 11.22
-- Dumped by pg_dump version 11.22

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: anpr_event_fact; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anpr_event_fact (
    id bigint NOT NULL,
    event_time timestamp with time zone NOT NULL,
    camera_id text NOT NULL,
    plate_number text NOT NULL,
    vehicle_type text,
    vehicle_color text,
    vehicle_make text,
    is_violation boolean DEFAULT false NOT NULL,
    violation_types text[],
    speed numeric,
    source_type text,
    source_name text,
    source_id text,
    source_ip text,
    camera_name text,
    event_10s_bucket timestamp with time zone
);


ALTER TABLE public.anpr_event_fact OWNER TO postgres;

--
-- Name: anpr_event_fact_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.anpr_event_fact_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.anpr_event_fact_id_seq OWNER TO postgres;

--
-- Name: anpr_event_fact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.anpr_event_fact_id_seq OWNED BY public.anpr_event_fact.id;


--
-- Name: live_camera_state; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.live_camera_state (
    camera_id text NOT NULL,
    crowd_count integer,
    crowd_state text,
    crowd_last_time timestamp with time zone,
    vehicle_count integer,
    traffic_state text,
    traffic_last_time timestamp with time zone,
    parking_occupancy integer,
    parking_capacity integer,
    parking_state text,
    parking_last_time timestamp with time zone,
    security_state text,
    security_last_time timestamp with time zone,
    last_event_time timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    camera_name text,
    source_id text,
    source_type text
);


ALTER TABLE public.live_camera_state OWNER TO postgres;

--
-- Name: mqtt_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mqtt_events (
    id bigint NOT NULL,
    event_time timestamp with time zone DEFAULT now() NOT NULL,
    camera_id text,
    event_type text,
    severity text,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    source_ip text,
    camera_name text,
    source_id text
);


ALTER TABLE public.mqtt_events OWNER TO postgres;

--
-- Name: mqtt_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.mqtt_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.mqtt_events_id_seq OWNER TO postgres;

--
-- Name: mqtt_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.mqtt_events_id_seq OWNED BY public.mqtt_events.id;


--
-- Name: vw_live_dashboard; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_live_dashboard AS
 SELECT live_camera_state.camera_id,
    live_camera_state.camera_name,
    live_camera_state.source_type,
    live_camera_state.updated_at,
        CASE
            WHEN (live_camera_state.last_event_time >= (now() - '00:02:00'::interval)) THEN 'ONLINE'::text
            ELSE 'OFFLINE'::text
        END AS camera_status,
        CASE
            WHEN (live_camera_state.crowd_last_time >= (now() - '00:02:00'::interval)) THEN live_camera_state.crowd_count
            ELSE NULL::integer
        END AS crowd_count,
        CASE
            WHEN (live_camera_state.crowd_last_time >= (now() - '00:02:00'::interval)) THEN live_camera_state.crowd_state
            ELSE 'UNKNOWN'::text
        END AS crowd_state,
        CASE
            WHEN (live_camera_state.traffic_last_time >= (now() - '00:02:00'::interval)) THEN live_camera_state.vehicle_count
            ELSE NULL::integer
        END AS vehicle_count,
        CASE
            WHEN (live_camera_state.traffic_last_time >= (now() - '00:02:00'::interval)) THEN live_camera_state.traffic_state
            ELSE 'UNKNOWN'::text
        END AS traffic_state,
        CASE
            WHEN (live_camera_state.parking_last_time >= (now() - '00:05:00'::interval)) THEN live_camera_state.parking_occupancy
            ELSE NULL::integer
        END AS parking_occupancy,
        CASE
            WHEN (live_camera_state.parking_last_time >= (now() - '00:05:00'::interval)) THEN live_camera_state.parking_state
            ELSE 'UNKNOWN'::text
        END AS parking_state,
        CASE
            WHEN (live_camera_state.security_last_time >= (now() - '00:01:00'::interval)) THEN live_camera_state.security_state
            ELSE NULL::text
        END AS security_state
   FROM public.live_camera_state;


ALTER TABLE public.vw_live_dashboard OWNER TO postgres;

--
-- Name: anpr_event_fact id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anpr_event_fact ALTER COLUMN id SET DEFAULT nextval('public.anpr_event_fact_id_seq'::regclass);


--
-- Name: mqtt_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mqtt_events ALTER COLUMN id SET DEFAULT nextval('public.mqtt_events_id_seq'::regclass);


--
-- Name: anpr_event_fact anpr_event_fact_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anpr_event_fact
    ADD CONSTRAINT anpr_event_fact_pkey PRIMARY KEY (id);


--
-- Name: live_camera_state live_camera_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.live_camera_state
    ADD CONSTRAINT live_camera_state_pkey PRIMARY KEY (camera_id);


--
-- Name: mqtt_events mqtt_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mqtt_events
    ADD CONSTRAINT mqtt_events_pkey PRIMARY KEY (id);


--
-- Name: idx_anpr_deduplication; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_anpr_deduplication ON public.anpr_event_fact USING btree (plate_number, camera_id, event_10s_bucket);


--
-- Name: idx_anpr_fact_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anpr_fact_time ON public.anpr_event_fact USING btree (event_time);


--
-- Name: idx_mqtt_events_camera; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mqtt_events_camera ON public.mqtt_events USING btree (camera_id);


--
-- Name: idx_mqtt_events_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mqtt_events_time ON public.mqtt_events USING btree (event_time DESC);


--
-- Name: idx_mqtt_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mqtt_events_type ON public.mqtt_events USING btree (event_type);


--
-- Name: anpr_event_fact trigger_set_anpr_bucket; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_set_anpr_bucket BEFORE INSERT OR UPDATE ON public.anpr_event_fact FOR EACH ROW EXECUTE PROCEDURE public.set_anpr_bucket_time();


--
-- PostgreSQL database dump complete
--

