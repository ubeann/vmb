--
-- PostgreSQL database dump
--


-- Dumped from database version 16.10 (Debian 16.10-1.pgdg13+1)
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-0ubuntu0.25.04.1)

SET statement_timeout = 0;
--> statement-breakpoint

SET lock_timeout = 0;
--> statement-breakpoint

SET idle_in_transaction_session_timeout = 0;
--> statement-breakpoint

SET client_encoding = 'UTF8';
--> statement-breakpoint

SET standard_conforming_strings = on;
--> statement-breakpoint

SELECT pg_catalog.set_config('search_path', '', false);
--> statement-breakpoint

SET check_function_bodies = false;
--> statement-breakpoint

SET xmloption = content;
--> statement-breakpoint

SET client_min_messages = warning;
--> statement-breakpoint

SET row_security = off;
--> statement-breakpoint


--
-- Name: expense; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA expense;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: master; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA master;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA trucking;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: warehouse; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA warehouse;
--> statement-breakpoint

SET default_tablespace = '';
--> statement-breakpoint

SET default_table_access_method = heap;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals; Type: TABLE; Schema: expense; Owner: -
--

CREATE TABLE expense.approvals (
    id uuid NOT NULL,
    approvable_type character varying(255) NOT NULL,
    approvable_id uuid NOT NULL,
    approver_id uuid,
    type character varying(255) NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    comment text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.approvals.id IS 'Unique item identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approvable_type; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.approvals.approvable_type IS 'Morphed model type';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approvable_id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.approvals.approvable_id IS 'Morphed model UUID';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approver_id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.approvals.approver_id IS 'Foreign key to the approver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.type; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.approvals.type IS 'Approval type (e.g., division, finance, director)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approved; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.approvals.approved IS 'Approval status (approved or rejected)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.comment; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.approvals.comment IS 'Comment for the approval';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: budgets; Type: TABLE; Schema: expense; Owner: -
--

CREATE TABLE expense.budgets (
    id uuid NOT NULL,
    division_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN budgets.id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.budgets.id IS 'UUID primary key column for the budget table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN budgets.division_id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.budgets.division_id IS 'Foreign key to the division that the budget belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN budgets.is_active; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.budgets.is_active IS 'Is the budget active?';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN budgets.amount; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.budgets.amount IS 'The amount of the budget';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: request_emergency_details; Type: TABLE; Schema: expense; Owner: -
--

CREATE TABLE expense.request_emergency_details (
    id uuid NOT NULL,
    request_id uuid NOT NULL,
    category character varying(255) NOT NULL,
    amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    budget_usage text NOT NULL,
    notes text,
    supporting_documents json,
    invoice_paths json,
    bank_transfer_proof character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.id IS 'UUID primary key column for the request emergency details table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.request_id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.request_id IS 'Foreign key to the request that this detail belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.category; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.category IS 'Emergency category level';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.amount; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.amount IS 'The amount of the emergency budget request';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.budget_usage; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.budget_usage IS 'Details on how the budget is used';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.notes; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.notes IS 'Notes or description for the niche budget request';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.supporting_documents; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.supporting_documents IS 'Array of supporting document file paths';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.invoice_paths; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.invoice_paths IS 'Array of invoice file paths';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_emergency_details.bank_transfer_proof; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_emergency_details.bank_transfer_proof IS 'Path to the transfer receipt file';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: request_niche_details; Type: TABLE; Schema: expense; Owner: -
--

CREATE TABLE expense.request_niche_details (
    id uuid NOT NULL,
    request_id uuid NOT NULL,
    amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    supporting_documents json,
    invoice_paths json,
    bank_transfer_proof character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_niche_details.id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_niche_details.id IS 'UUID primary key column for the request niche details table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_niche_details.request_id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_niche_details.request_id IS 'Foreign key to the request that this detail belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_niche_details.amount; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_niche_details.amount IS 'The amount of the niche budget request';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_niche_details.notes; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_niche_details.notes IS 'Notes or description for the niche budget request';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_niche_details.supporting_documents; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_niche_details.supporting_documents IS 'Array of supporting document file paths';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_niche_details.invoice_paths; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_niche_details.invoice_paths IS 'Array of invoice file paths';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN request_niche_details.bank_transfer_proof; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.request_niche_details.bank_transfer_proof IS 'Path to the transfer receipt file';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: requests; Type: TABLE; Schema: expense; Owner: -
--

CREATE TABLE expense.requests (
    id uuid NOT NULL,
    user_id uuid,
    division_id uuid NOT NULL,
    type character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN requests.id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.requests.id IS 'UUID primary key column for the request table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN requests.user_id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.requests.user_id IS 'Foreign key to the user who created the request';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN requests.division_id; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.requests.division_id IS 'Foreign key to the division that the request belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN requests.type; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.requests.type IS 'Type of the expense request, e.g., travel, supplies, etc.';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN requests.status; Type: COMMENT; Schema: expense; Owner: -
--

COMMENT ON COLUMN expense.requests.status IS 'Status of the request, e.g., pending, approved, rejected';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: divisions; Type: TABLE; Schema: master; Owner: -
--

CREATE TABLE master.divisions (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(255),
    description character varying(255),
    color_hex character varying(255) DEFAULT '#000000'::character varying NOT NULL,
    icon_name character varying(255) DEFAULT 'heroicon-o-rocket-launch'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN divisions.id; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.divisions.id IS 'Unique division identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN divisions.name; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.divisions.name IS 'Division name (e.g., Sales, Marketing)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN divisions.code; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.divisions.code IS 'Division code (e.g., SALES, MKTG)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN divisions.description; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.divisions.description IS 'Division description (optional)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN divisions.color_hex; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.divisions.color_hex IS 'Division color (HEX)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN divisions.icon_name; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.divisions.icon_name IS 'Division icon name';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN divisions.is_active; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.divisions.is_active IS 'Division status (active or inactive)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: users; Type: TABLE; Schema: master; Owner: -
--

CREATE TABLE master.users (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'active'::character varying NOT NULL,
    division_id uuid,
    phone character varying(20),
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    profile_photo_path character varying(255),
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('suspended'::character varying)::text])))
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.id; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.id IS 'Unique user identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.name; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.name IS 'User full name';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.status; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.status IS 'User status';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.division_id; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.division_id IS 'Foreign key to the division that the user belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.phone; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.phone IS 'User phone number';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.email; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.email IS 'User email address';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.email_verified_at; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.email_verified_at IS 'Email verification timestamp';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.profile_photo_path; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.profile_photo_path IS 'User profile photo path';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN users.password; Type: COMMENT; Schema: master; Owner: -
--

COMMENT ON COLUMN master.users.password IS 'User password';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.approvals (
    id uuid NOT NULL,
    approvable_type character varying(255) NOT NULL,
    approvable_id uuid NOT NULL,
    approver_id uuid,
    type character varying(255) NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    comment text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.approvals.id IS 'Unique item identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approvable_type; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.approvals.approvable_type IS 'Morphed model type';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approvable_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.approvals.approvable_id IS 'Morphed model UUID';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approver_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.approvals.approver_id IS 'Foreign key to the approver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.type; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.approvals.type IS 'Approval type (e.g., division, finance, director)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approved; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.approvals.approved IS 'Approval status (approved or rejected)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.comment; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.approvals.comment IS 'Comment for the approval';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_route; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.client_route (
    id bigint NOT NULL,
    client_id uuid NOT NULL,
    route_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN client_route.client_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.client_route.client_id IS 'The client ID in the relationship';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN client_route.route_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.client_route.route_id IS 'The route ID in the relationship';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_route_id_seq; Type: SEQUENCE; Schema: trucking; Owner: -
--

CREATE SEQUENCE trucking.client_route_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_route_id_seq; Type: SEQUENCE OWNED BY; Schema: trucking; Owner: -
--

ALTER SEQUENCE trucking.client_route_id_seq OWNED BY trucking.client_route.id;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_truck_companies; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.client_truck_companies (
    id uuid NOT NULL,
    client_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    editable_dtp boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN client_truck_companies.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.client_truck_companies.id IS 'UUID primary key column for the client truck companies table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN client_truck_companies.client_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.client_truck_companies.client_id IS 'The client that owns this truck company';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN client_truck_companies.name; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.client_truck_companies.name IS 'The truck company name';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN client_truck_companies.editable_dtp; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.client_truck_companies.editable_dtp IS 'Indicates whether this truck company can edit DTP';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: clients; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.clients (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(255) NOT NULL,
    pic character varying(255),
    email character varying(255),
    phone character varying(255),
    address text,
    logo_path character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN clients.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.clients.id IS 'UUID primary key column for the clients table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN clients.name; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.clients.name IS 'The name of the client';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN clients.code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.clients.code IS 'The code of the client';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN clients.pic; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.clients.pic IS 'The name of the person in charge (PIC) of the client';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN clients.email; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.clients.email IS 'The email address of the client';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN clients.phone; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.clients.phone IS 'The phone number of the client';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN clients.address; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.clients.address IS 'The address of the client';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN clients.logo_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.clients.logo_path IS 'The path to the client''s logo';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_actuals; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.daily_trucking_actuals (
    id uuid NOT NULL,
    daily_trucking_plan_id uuid NOT NULL,
    order_id uuid NOT NULL,
    truck_id uuid,
    user_id uuid,
    driver_id uuid,
    trip_id uuid,
    plan_code character varying(255) NOT NULL,
    composite_code character varying(255) NOT NULL,
    size integer NOT NULL,
    fee integer NOT NULL,
    allowance numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    is_lolo boolean DEFAULT false NOT NULL,
    lolo_fee numeric(15,2),
    route_reference character varying(255) NOT NULL,
    changed_routes json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.id IS 'UUID primary key column for the daily trucking plan table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.daily_trucking_plan_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.daily_trucking_plan_id IS 'Foreign key to the daily trucking plan that made the daily trucking actual';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.order_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.order_id IS 'Foreign key to the order that made the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.truck_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.truck_id IS 'Foreign key to the truck that made the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.user_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.user_id IS 'Foreign key to the submitter of the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.driver_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.driver_id IS 'Foreign key to the driver that made the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.trip_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.trip_id IS 'Foreign key to the trip that made the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.plan_code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.plan_code IS 'Unique code identifying the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.composite_code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.composite_code IS 'Composite code combining order, trip, and trucking plan information';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.size; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.size IS 'The size of the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.fee; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.fee IS 'The fee of the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.allowance; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.allowance IS 'The allowance of the route';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.is_lolo; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.is_lolo IS 'Is the route a LoLo route?';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.lolo_fee; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.lolo_fee IS 'The LoLo fee of the route';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.route_reference; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.route_reference IS 'Route reference ID or code from routes table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_actuals.changed_routes; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_actuals.changed_routes IS 'The changed route snapshot of the daily trucking actuals';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_plans; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.daily_trucking_plans (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    truck_id uuid,
    user_id uuid,
    driver_id uuid,
    trip_id uuid,
    plan_code character varying(255) NOT NULL,
    composite_code character varying(255) NOT NULL,
    size integer NOT NULL,
    fee integer NOT NULL,
    allowance numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    is_lolo boolean DEFAULT false NOT NULL,
    lolo_fee numeric(15,2),
    route_reference character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.id IS 'UUID primary key column for the daily trucking plan table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.order_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.order_id IS 'Foreign key to the order that made the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.truck_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.truck_id IS 'Foreign key to the truck that made the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.user_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.user_id IS 'Foreign key to the submitter of the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.driver_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.driver_id IS 'Foreign key to the driver that made the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.trip_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.trip_id IS 'Foreign key to the trip that made the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.plan_code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.plan_code IS 'Unique code identifying the daily trucking plan';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.composite_code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.composite_code IS 'Composite code combining order, trip, and trucking plan information';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.size; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.size IS 'The size of the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.fee; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.fee IS 'The fee of the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.allowance; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.allowance IS 'The allowance of the route';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.is_lolo; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.is_lolo IS 'Is the route a LoLo route?';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.lolo_fee; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.lolo_fee IS 'The LoLo fee of the route';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN daily_trucking_plans.route_reference; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.daily_trucking_plans.route_reference IS 'Route reference ID or code from routes table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: drivers; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.drivers (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    date_of_birth date NOT NULL,
    identification_number character varying(255) NOT NULL,
    license_number character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    address text NOT NULL,
    profile_photo_path character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN drivers.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.drivers.id IS 'UUID primary key column for the drivers table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN drivers.name; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.drivers.name IS 'The name of the driver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN drivers.date_of_birth; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.drivers.date_of_birth IS 'The date of birth of the driver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN drivers.identification_number; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.drivers.identification_number IS 'The identification number of the driver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN drivers.license_number; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.drivers.license_number IS 'The license number of the driver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN drivers.phone; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.drivers.phone IS 'The phone number of the driver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN drivers.address; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.drivers.address IS 'The address of the driver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN drivers.profile_photo_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.drivers.profile_photo_path IS 'The path to the driver''s profile photo';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_comments; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.invoice_comments (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    user_id uuid,
    invoice_status character varying(50) NOT NULL,
    comment text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_comments.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_comments.id IS 'Unique item identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_comments.invoice_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_comments.invoice_id IS 'Foreign key to the invoice that this detail belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_comments.user_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_comments.user_id IS 'Foreign key to the user who made the comment';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_shipments; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.invoice_shipments (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    vessel_name character varying(255),
    voyage character varying(255),
    shipping_agent character varying(255),
    etd date,
    booking_no character varying(255),
    actual_20_hc integer DEFAULT 0 NOT NULL,
    actual_40_hc integer DEFAULT 0 NOT NULL,
    dest_code character varying(255),
    bill_number character varying(255),
    order_number character varying(255),
    handling_pricing numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    port_charge_20hc numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    port_charge_40hc numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    contact_name character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_shipments.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_shipments.id IS 'Unique item identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_shipments.invoice_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_shipments.invoice_id IS 'Foreign key to the invoice that this detail belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_shipments.bill_number; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_shipments.bill_number IS 'Bill of lading or billing number';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_shipments.order_number; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_shipments.order_number IS 'Additional order reference number';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_shipments.handling_pricing; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_shipments.handling_pricing IS 'Handling charge amount';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_shipments.port_charge_20hc; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_shipments.port_charge_20hc IS 'Port charge for 20HC container';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_shipments.port_charge_40hc; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_shipments.port_charge_40hc IS 'Port charge for 40HC container';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_shipments.contact_name; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_shipments.contact_name IS 'Name of contact person';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_vendor; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.invoice_vendor (
    id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    unit_price numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    description character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_vendor.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_vendor.id IS 'Unique item identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_vendor.invoice_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_vendor.invoice_id IS 'Foreign key to the invoice that this detail belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_vendor.quantity; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_vendor.quantity IS 'Quantity of items or services';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_vendor.unit_price; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_vendor.unit_price IS 'Unit price of the item or service';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoice_vendor.description; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoice_vendor.description IS 'Description of the item or service';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoices; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.invoices (
    id uuid NOT NULL,
    client_id uuid NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    countdown integer DEFAULT 0 NOT NULL,
    time_table_path character varying(255),
    list_container_full_path character varying(255),
    kwitansi_port_charge_path character varying(255),
    peb_path character varying(255),
    npe_path character varying(255),
    booking_shipping_line_path character varying(255),
    invoice_port_charge_path character varying(255),
    invoice_handling_path character varying(255),
    e_faktur_path character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    additional_files json,
    notes text,
    amount_total numeric(15,2),
    amount_billed numeric(15,2)
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.id IS 'UUID primary key column for the invoices table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.client_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.client_id IS 'Foreign key to the client that the invoice belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.status; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.status IS 'Status of the invoice (draft, sent, paid, etc.)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.countdown; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.countdown IS 'Countdown for the invoice, used for tracking purposes';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.time_table_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.time_table_path IS 'Path to the time table document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.list_container_full_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.list_container_full_path IS 'Path to the list container full document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.kwitansi_port_charge_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.kwitansi_port_charge_path IS 'Path to the kwitansi port charge document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.peb_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.peb_path IS 'Path to the PEB (Pemberitahuan Ekspor Barang) document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.npe_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.npe_path IS 'Path to the NPE (Nota Pelayanan Ekspor) document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.booking_shipping_line_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.booking_shipping_line_path IS 'Path to the booking shipping line document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.invoice_port_charge_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.invoice_port_charge_path IS 'Path to the invoice port charge document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.invoice_handling_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.invoice_handling_path IS 'Path to the invoice handling document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.e_faktur_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.e_faktur_path IS 'Path to the E-FAKTUR document associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.additional_files; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.additional_files IS 'Stores an array of additional file paths associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.notes; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.notes IS 'Additional notes or comments related to the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.amount_total; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.amount_total IS 'Total amount of the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN invoices.amount_billed; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.invoices.amount_billed IS 'Billed amount of the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: locations; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.locations (
    id uuid NOT NULL,
    code character varying(255) NOT NULL,
    name character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN locations.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.locations.id IS 'UUID primary key column for the location table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN locations.code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.locations.code IS 'The code of the location';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN locations.name; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.locations.name IS 'The name of the location';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: orders; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.orders (
    id uuid NOT NULL,
    client_id uuid NOT NULL,
    code integer NOT NULL,
    type character varying(255) NOT NULL,
    party_count integer NOT NULL,
    status character varying(255) NOT NULL,
    evidence_path character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    direction character varying(255) DEFAULT 'import'::character varying NOT NULL,
    trip_count integer DEFAULT 0 NOT NULL,
    additional_files json,
    additional_allowances json,
    reference_code character varying(255),
    client_truck_company_id uuid,
    reference_id uuid,
    cancelled_at timestamp(0) without time zone,
    cancelled_by uuid,
    cancel_reason text,
    custom_invoice_codes json,
    submitted_for_payment_at timestamp(0) without time zone,
    payment_received_at timestamp(0) without time zone,
    payment_documents json,
    payment_notes text
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.id IS 'UUID primary key column for the orders table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.client_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.client_id IS 'Foreign key to the client that made the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.code IS 'The code of the orders';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.type; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.type IS 'The type of the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.party_count; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.party_count IS 'The number of parties in the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.status; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.status IS 'The status of the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.evidence_path; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.evidence_path IS 'The path to the evidence of the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.direction; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.direction IS 'Specifies whether the order is for import or export';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.trip_count; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.trip_count IS 'The number of trips for the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.additional_files; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.additional_files IS 'Stores an array of additional file paths associated with the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.additional_allowances; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.additional_allowances IS 'Stores an array of additional allowances and details for the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.reference_code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.reference_code IS 'Reference identifier for the invoice';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.client_truck_company_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.client_truck_company_id IS 'Optional selected truck company for this order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.reference_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.reference_id IS 'Reference identifier for the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.cancelled_at; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.cancelled_at IS 'Timestamp when the order was cancelled';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.cancelled_by; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.cancelled_by IS 'Foreign key to the user who cancelled the order';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.cancel_reason; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.cancel_reason IS 'Reason why the order was cancelled';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.custom_invoice_codes; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.custom_invoice_codes IS 'Custom invoice code suffixes for each type: {normal, changed, lolo}';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.submitted_for_payment_at; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.submitted_for_payment_at IS 'Timestamp when the order was submitted for payment';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.payment_received_at; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.payment_received_at IS 'Timestamp when the payment was received and confirmed';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.payment_documents; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.payment_documents IS 'JSON field storing payment supporting documents with upload metadata';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN orders.payment_notes; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.orders.payment_notes IS 'Payment reference number, bank details, or additional payment notes';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: route_locations; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.route_locations (
    id uuid NOT NULL,
    route_id uuid NOT NULL,
    location_id uuid NOT NULL,
    "position" integer NOT NULL,
    load_type character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    is_visible boolean DEFAULT true NOT NULL,
    label character varying(255),
    CONSTRAINT route_locations_load_type_check CHECK (((load_type)::text = ANY (ARRAY[('E'::character varying)::text, ('F'::character varying)::text])))
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN route_locations.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.route_locations.id IS 'UUID primary key column for the route location table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN route_locations.route_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.route_locations.route_id IS 'Foreign key to the route that made the route location';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN route_locations.location_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.route_locations.location_id IS 'Foreign key to the location that made the route location';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN route_locations."position"; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.route_locations."position" IS 'The position of the location in the route';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN route_locations.load_type; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.route_locations.load_type IS 'The load type of the location in the route';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN route_locations.is_visible; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.route_locations.is_visible IS 'Whether this location should be visible on invoices';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN route_locations.label; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.route_locations.label IS 'Label for this location on invoices';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: routes; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.routes (
    id uuid NOT NULL,
    size integer NOT NULL,
    fee numeric(15,2) NOT NULL,
    allowance numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    is_lolo boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN routes.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.routes.id IS 'UUID primary key column for the route table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN routes.size; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.routes.size IS 'The size of the container';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN routes.fee; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.routes.fee IS 'The fee of the route';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN routes.allowance; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.routes.allowance IS 'The allowance of the route';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN routes.is_lolo; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.routes.is_lolo IS 'Is the route a LoLo route?';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trips; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.trips (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    code character varying(255) NOT NULL,
    total_units integer NOT NULL,
    routes json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    route_reference_id uuid
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trips.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trips.id IS 'UUID primary key column for the trips table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trips.order_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trips.order_id IS 'Foreign key to the order that made the trip';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trips.code; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trips.code IS 'The code of the trip';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trips.total_units; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trips.total_units IS 'The total units of the trip';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trips.routes; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trips.routes IS 'The route snapshot of the trips';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trips.route_reference_id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trips.route_reference_id IS 'UUID of the route associated with the trip';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucks; Type: TABLE; Schema: trucking; Owner: -
--

CREATE TABLE trucking.trucks (
    id uuid NOT NULL,
    license_plate character varying(255) NOT NULL,
    brand character varying(255) NOT NULL,
    production_year integer NOT NULL,
    last_maintenance date NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trucks.id; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trucks.id IS 'UUID primary key column for the trucks table';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trucks.license_plate; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trucks.license_plate IS 'The license plate of the truck';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trucks.brand; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trucks.brand IS 'The brand of the truck';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trucks.production_year; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trucks.production_year IS 'The production year of the truck';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN trucks.last_maintenance; Type: COMMENT; Schema: trucking; Owner: -
--

COMMENT ON COLUMN trucking.trucks.last_maintenance IS 'The date of the last maintenance of the truck';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.approvals (
    id uuid NOT NULL,
    approvable_type character varying(255) NOT NULL,
    approvable_id uuid NOT NULL,
    approver_id uuid,
    type character varying(255) NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    comment text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.approvals.id IS 'Unique item identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approvable_type; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.approvals.approvable_type IS 'Morphed model type';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approvable_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.approvals.approvable_id IS 'Morphed model UUID';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approver_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.approvals.approver_id IS 'Foreign key to the approver';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.type; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.approvals.type IS 'Approval type (e.g., division, finance, director)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.approved; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.approvals.approved IS 'Approval status (approved or rejected)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN approvals.comment; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.approvals.comment IS 'Comment for the approval';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: items; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.items (
    id uuid NOT NULL,
    division_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(255),
    description text,
    icon_name character varying(255) DEFAULT 'heroicon-o-cube'::character varying NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN items.id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.id IS 'Unique item identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN items.division_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.division_id IS 'Foreign key to the division that the item belongs to';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN items.name; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.name IS 'Item name';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN items.code; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.code IS 'Item code';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN items.description; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.description IS 'Item description';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN items.icon_name; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.icon_name IS 'Item icon name';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN items.current_stock; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.current_stock IS 'Current stock level';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN items.reorder_level; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.items.reorder_level IS 'Reorder level (minimum stock level)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: procurement_quotations; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.procurement_quotations (
    id uuid NOT NULL,
    quoted_price numeric(10,2) NOT NULL,
    vendor_name character varying(255) NOT NULL,
    vendor_website character varying(255) NOT NULL,
    vendor_phone character varying(255),
    invoice_url character varying(255),
    invoice_file_path character varying(255),
    payment_account character varying(255) NOT NULL,
    payment_proof_path character varying(255),
    payment_date timestamp(0) without time zone,
    receipt_proof_path character varying(255),
    receipt_date timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.id IS 'Unique procurement quotation identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.quoted_price; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.quoted_price IS 'Quoted price (price of the item)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.vendor_name; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.vendor_name IS 'Vendor name';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.vendor_website; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.vendor_website IS 'Vendor website (e.g., URL of vendor website or Maps URL)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.invoice_url; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.invoice_url IS 'Invoice URL (e.g., URL of invoice file)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.invoice_file_path; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.invoice_file_path IS 'Invoice file path (e.g., PDF file of invoice)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.payment_account; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.payment_account IS 'Payment account (e.g., bank account number)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.payment_proof_path; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.payment_proof_path IS 'Payment proof path (e.g., image of payment receipt)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.payment_date; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.payment_date IS 'Payment date (date of payment)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.receipt_proof_path; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.receipt_proof_path IS 'Receipt proof path (e.g., image of receipt)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_quotations.receipt_date; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_quotations.receipt_date IS 'Receipt date (date of purchase)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: procurement_requests; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.procurement_requests (
    id uuid NOT NULL,
    request_number character varying(255) NOT NULL,
    requester_id uuid NOT NULL,
    item_id uuid NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    requested_quantity integer NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    justification text NOT NULL,
    quotation_id uuid,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    completed_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.id IS 'Unique procurement request identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.request_number; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.request_number IS 'Request number (e.g., REQ/2024/0001)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.requester_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.requester_id IS 'Foreign key to the requester of the procurement request';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.item_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.item_id IS 'Foreign key to the item that is requested';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.status; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.status IS 'Request status (e.g., pending, approved, rejected)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.unit_price; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.unit_price IS 'Unit price (price of the item)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.requested_quantity; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.requested_quantity IS 'Requested quantity (number of items)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.total_amount; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.total_amount IS 'Total amount (total price of the items)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.justification; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.justification IS 'Justification for the procurement request';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.quotation_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.quotation_id IS 'Foreign key to the quotation for the procurement request';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN procurement_requests.completed_at; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.procurement_requests.completed_at IS 'Timestamp of when the request was completed';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_alerts; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.stock_alerts (
    id uuid NOT NULL,
    item_id uuid NOT NULL,
    last_stock integer NOT NULL,
    last_requisition_id uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_alerts.id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_alerts.id IS 'Unique stock alert identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_alerts.item_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_alerts.item_id IS 'Foreign key to the item that has a stock alert';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_alerts.last_stock; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_alerts.last_stock IS 'Last stock level before the alert';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_alerts.last_requisition_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_alerts.last_requisition_id IS 'Foreign key to the last stock requisition that was made';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_requisitions; Type: TABLE; Schema: warehouse; Owner: -
--

CREATE TABLE warehouse.stock_requisitions (
    id uuid NOT NULL,
    requisition_number character varying(255) NOT NULL,
    requester_id uuid NOT NULL,
    item_id uuid NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    requested_quantity integer NOT NULL,
    stock_on_hand integer,
    purpose text NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    completed_at timestamp(0) without time zone
);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.id IS 'Unique stock requisition identifier';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.requisition_number; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.requisition_number IS 'Requisition number (e.g., REQ/2024/0001)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.requester_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.requester_id IS 'Foreign key to the requester of the stock requisition';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.item_id; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.item_id IS 'Foreign key to the item that is requested';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.status; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.status IS 'Requisition status (e.g., pending, approved, rejected)';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.requested_quantity; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.requested_quantity IS 'Quantity requested';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.stock_on_hand; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.stock_on_hand IS 'Current stock on hand';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.purpose; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.purpose IS 'Reason for requisition';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: COLUMN stock_requisitions.completed_at; Type: COMMENT; Schema: warehouse; Owner: -
--

COMMENT ON COLUMN warehouse.stock_requisitions.completed_at IS 'Timestamp of when the requisition was completed';
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_route id; Type: DEFAULT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.client_route ALTER COLUMN id SET DEFAULT nextval('trucking.client_route_id_seq'::regclass);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: request_emergency_details request_emergency_details_pkey; Type: CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.request_emergency_details
    ADD CONSTRAINT request_emergency_details_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: request_niche_details request_niche_details_pkey; Type: CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.request_niche_details
    ADD CONSTRAINT request_niche_details_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: divisions divisions_pkey; Type: CONSTRAINT; Schema: master; Owner: -
--

ALTER TABLE ONLY master.divisions
    ADD CONSTRAINT divisions_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: divisions master_divisions_code_unique; Type: CONSTRAINT; Schema: master; Owner: -
--

ALTER TABLE ONLY master.divisions
    ADD CONSTRAINT master_divisions_code_unique UNIQUE (code);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: divisions master_divisions_name_unique; Type: CONSTRAINT; Schema: master; Owner: -
--

ALTER TABLE ONLY master.divisions
    ADD CONSTRAINT master_divisions_name_unique UNIQUE (name);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: users master_users_email_unique; Type: CONSTRAINT; Schema: master; Owner: -
--

ALTER TABLE ONLY master.users
    ADD CONSTRAINT master_users_email_unique UNIQUE (email);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: users users_pkey; Type: CONSTRAINT; Schema: master; Owner: -
--

ALTER TABLE ONLY master.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_route client_route_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.client_route
    ADD CONSTRAINT client_route_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_truck_companies client_truck_companies_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.client_truck_companies
    ADD CONSTRAINT client_truck_companies_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_actuals daily_trucking_actuals_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_actuals
    ADD CONSTRAINT daily_trucking_actuals_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_plans daily_trucking_plans_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_plans
    ADD CONSTRAINT daily_trucking_plans_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_comments invoice_comments_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoice_comments
    ADD CONSTRAINT invoice_comments_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_shipments invoice_shipments_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoice_shipments
    ADD CONSTRAINT invoice_shipments_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_vendor invoice_vendor_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoice_vendor
    ADD CONSTRAINT invoice_vendor_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: route_locations route_locations_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.route_locations
    ADD CONSTRAINT route_locations_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_route trucking_client_route_client_id_route_id_unique; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.client_route
    ADD CONSTRAINT trucking_client_route_client_id_route_id_unique UNIQUE (client_id, route_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: clients trucking_clients_code_unique; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.clients
    ADD CONSTRAINT trucking_clients_code_unique UNIQUE (code);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: clients trucking_clients_email_unique; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.clients
    ADD CONSTRAINT trucking_clients_email_unique UNIQUE (email);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: drivers trucking_drivers_identification_number_unique; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.drivers
    ADD CONSTRAINT trucking_drivers_identification_number_unique UNIQUE (identification_number);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: drivers trucking_drivers_license_number_unique; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.drivers
    ADD CONSTRAINT trucking_drivers_license_number_unique UNIQUE (license_number);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: drivers trucking_drivers_phone_unique; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.drivers
    ADD CONSTRAINT trucking_drivers_phone_unique UNIQUE (phone);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: orders trucking_orders_code_unique; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.orders
    ADD CONSTRAINT trucking_orders_code_unique UNIQUE (code);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucks trucking_trucks_license_plate_unique; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.trucks
    ADD CONSTRAINT trucking_trucks_license_plate_unique UNIQUE (license_plate);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucks trucks_pkey; Type: CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.trucks
    ADD CONSTRAINT trucks_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: items items_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: procurement_quotations procurement_quotations_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.procurement_quotations
    ADD CONSTRAINT procurement_quotations_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: procurement_requests procurement_requests_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.procurement_requests
    ADD CONSTRAINT procurement_requests_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_alerts stock_alerts_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.stock_alerts
    ADD CONSTRAINT stock_alerts_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_requisitions stock_requisitions_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.stock_requisitions
    ADD CONSTRAINT stock_requisitions_pkey PRIMARY KEY (id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: items warehouse_items_code_unique; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT warehouse_items_code_unique UNIQUE (code);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: procurement_requests warehouse_procurement_requests_request_number_unique; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.procurement_requests
    ADD CONSTRAINT warehouse_procurement_requests_request_number_unique UNIQUE (request_number);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_requisitions warehouse_stock_requisitions_requisition_number_unique; Type: CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.stock_requisitions
    ADD CONSTRAINT warehouse_stock_requisitions_requisition_number_unique UNIQUE (requisition_number);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvable_index; Type: INDEX; Schema: expense; Owner: -
--

CREATE INDEX approvable_index ON expense.approvals USING btree (approvable_type, approvable_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvable_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX approvable_index ON trucking.approvals USING btree (approvable_type, approvable_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_client_route_client_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_client_route_client_id_index ON trucking.client_route USING btree (client_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_client_route_route_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_client_route_route_id_index ON trucking.client_route USING btree (route_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_client_truck_companies_client_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_client_truck_companies_client_id_index ON trucking.client_truck_companies USING btree (client_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_client_truck_companies_name_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_client_truck_companies_name_index ON trucking.client_truck_companies USING btree (name);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_clients_code_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_clients_code_index ON trucking.clients USING btree (code);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_clients_name_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_clients_name_index ON trucking.clients USING btree (name);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_daily_trucking_actuals_daily_trucking_plan_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_daily_trucking_actuals_daily_trucking_plan_id_index ON trucking.daily_trucking_actuals USING btree (daily_trucking_plan_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_daily_trucking_actuals_order_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_daily_trucking_actuals_order_id_index ON trucking.daily_trucking_actuals USING btree (order_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_daily_trucking_actuals_truck_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_daily_trucking_actuals_truck_id_index ON trucking.daily_trucking_actuals USING btree (truck_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_daily_trucking_actuals_user_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_daily_trucking_actuals_user_id_index ON trucking.daily_trucking_actuals USING btree (user_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_daily_trucking_plans_order_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_daily_trucking_plans_order_id_index ON trucking.daily_trucking_plans USING btree (order_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_daily_trucking_plans_truck_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_daily_trucking_plans_truck_id_index ON trucking.daily_trucking_plans USING btree (truck_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_daily_trucking_plans_user_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_daily_trucking_plans_user_id_index ON trucking.daily_trucking_plans USING btree (user_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_drivers_name_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_drivers_name_index ON trucking.drivers USING btree (name);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_invoice_comments_invoice_id_created_at_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_invoice_comments_invoice_id_created_at_index ON trucking.invoice_comments USING btree (invoice_id, created_at);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_invoice_comments_user_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_invoice_comments_user_id_index ON trucking.invoice_comments USING btree (user_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_locations_code_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_locations_code_index ON trucking.locations USING btree (code);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_orders_client_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_orders_client_id_index ON trucking.orders USING btree (client_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_orders_client_truck_company_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_orders_client_truck_company_id_index ON trucking.orders USING btree (client_truck_company_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_orders_code_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_orders_code_index ON trucking.orders USING btree (code);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_orders_status_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_orders_status_index ON trucking.orders USING btree (status);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_route_locations_load_type_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_route_locations_load_type_index ON trucking.route_locations USING btree (load_type);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_route_locations_location_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_route_locations_location_id_index ON trucking.route_locations USING btree (location_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_route_locations_position_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_route_locations_position_index ON trucking.route_locations USING btree ("position");
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_route_locations_route_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_route_locations_route_id_index ON trucking.route_locations USING btree (route_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_routes_size_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_routes_size_index ON trucking.routes USING btree (size);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_trips_code_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_trips_code_index ON trucking.trips USING btree (code);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_trips_order_id_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_trips_order_id_index ON trucking.trips USING btree (order_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trucking_trucks_license_plate_index; Type: INDEX; Schema: trucking; Owner: -
--

CREATE INDEX trucking_trucks_license_plate_index ON trucking.trucks USING btree (license_plate);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvable_index; Type: INDEX; Schema: warehouse; Owner: -
--

CREATE INDEX approvable_index ON warehouse.approvals USING btree (approvable_type, approvable_id);
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals expense_approvals_approver_id_foreign; Type: FK CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.approvals
    ADD CONSTRAINT expense_approvals_approver_id_foreign FOREIGN KEY (approver_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: budgets expense_budgets_division_id_foreign; Type: FK CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.budgets
    ADD CONSTRAINT expense_budgets_division_id_foreign FOREIGN KEY (division_id) REFERENCES master.divisions(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: request_emergency_details expense_request_emergency_details_request_id_foreign; Type: FK CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.request_emergency_details
    ADD CONSTRAINT expense_request_emergency_details_request_id_foreign FOREIGN KEY (request_id) REFERENCES expense.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: request_niche_details expense_request_niche_details_request_id_foreign; Type: FK CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.request_niche_details
    ADD CONSTRAINT expense_request_niche_details_request_id_foreign FOREIGN KEY (request_id) REFERENCES expense.requests(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: requests expense_requests_division_id_foreign; Type: FK CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.requests
    ADD CONSTRAINT expense_requests_division_id_foreign FOREIGN KEY (division_id) REFERENCES master.divisions(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: requests expense_requests_user_id_foreign; Type: FK CONSTRAINT; Schema: expense; Owner: -
--

ALTER TABLE ONLY expense.requests
    ADD CONSTRAINT expense_requests_user_id_foreign FOREIGN KEY (user_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: users master_users_division_id_foreign; Type: FK CONSTRAINT; Schema: master; Owner: -
--

ALTER TABLE ONLY master.users
    ADD CONSTRAINT master_users_division_id_foreign FOREIGN KEY (division_id) REFERENCES master.divisions(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals trucking_approvals_approver_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.approvals
    ADD CONSTRAINT trucking_approvals_approver_id_foreign FOREIGN KEY (approver_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_route trucking_client_route_client_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.client_route
    ADD CONSTRAINT trucking_client_route_client_id_foreign FOREIGN KEY (client_id) REFERENCES trucking.clients(id) ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_route trucking_client_route_route_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.client_route
    ADD CONSTRAINT trucking_client_route_route_id_foreign FOREIGN KEY (route_id) REFERENCES trucking.routes(id) ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: client_truck_companies trucking_client_truck_companies_client_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.client_truck_companies
    ADD CONSTRAINT trucking_client_truck_companies_client_id_foreign FOREIGN KEY (client_id) REFERENCES trucking.clients(id) ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_actuals trucking_daily_trucking_actuals_daily_trucking_plan_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_actuals
    ADD CONSTRAINT trucking_daily_trucking_actuals_daily_trucking_plan_id_foreign FOREIGN KEY (daily_trucking_plan_id) REFERENCES trucking.daily_trucking_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_actuals trucking_daily_trucking_actuals_driver_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_actuals
    ADD CONSTRAINT trucking_daily_trucking_actuals_driver_id_foreign FOREIGN KEY (driver_id) REFERENCES trucking.drivers(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_actuals trucking_daily_trucking_actuals_order_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_actuals
    ADD CONSTRAINT trucking_daily_trucking_actuals_order_id_foreign FOREIGN KEY (order_id) REFERENCES trucking.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_actuals trucking_daily_trucking_actuals_trip_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_actuals
    ADD CONSTRAINT trucking_daily_trucking_actuals_trip_id_foreign FOREIGN KEY (trip_id) REFERENCES trucking.trips(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_actuals trucking_daily_trucking_actuals_truck_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_actuals
    ADD CONSTRAINT trucking_daily_trucking_actuals_truck_id_foreign FOREIGN KEY (truck_id) REFERENCES trucking.trucks(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_actuals trucking_daily_trucking_actuals_user_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_actuals
    ADD CONSTRAINT trucking_daily_trucking_actuals_user_id_foreign FOREIGN KEY (user_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_plans trucking_daily_trucking_plans_driver_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_plans
    ADD CONSTRAINT trucking_daily_trucking_plans_driver_id_foreign FOREIGN KEY (driver_id) REFERENCES trucking.drivers(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_plans trucking_daily_trucking_plans_order_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_plans
    ADD CONSTRAINT trucking_daily_trucking_plans_order_id_foreign FOREIGN KEY (order_id) REFERENCES trucking.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_plans trucking_daily_trucking_plans_trip_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_plans
    ADD CONSTRAINT trucking_daily_trucking_plans_trip_id_foreign FOREIGN KEY (trip_id) REFERENCES trucking.trips(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_plans trucking_daily_trucking_plans_truck_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_plans
    ADD CONSTRAINT trucking_daily_trucking_plans_truck_id_foreign FOREIGN KEY (truck_id) REFERENCES trucking.trucks(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: daily_trucking_plans trucking_daily_trucking_plans_user_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.daily_trucking_plans
    ADD CONSTRAINT trucking_daily_trucking_plans_user_id_foreign FOREIGN KEY (user_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_comments trucking_invoice_comments_invoice_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoice_comments
    ADD CONSTRAINT trucking_invoice_comments_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES trucking.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_comments trucking_invoice_comments_user_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoice_comments
    ADD CONSTRAINT trucking_invoice_comments_user_id_foreign FOREIGN KEY (user_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_shipments trucking_invoice_shipments_invoice_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoice_shipments
    ADD CONSTRAINT trucking_invoice_shipments_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES trucking.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoice_vendor trucking_invoice_vendor_invoice_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoice_vendor
    ADD CONSTRAINT trucking_invoice_vendor_invoice_id_foreign FOREIGN KEY (invoice_id) REFERENCES trucking.invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: invoices trucking_invoices_client_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.invoices
    ADD CONSTRAINT trucking_invoices_client_id_foreign FOREIGN KEY (client_id) REFERENCES trucking.clients(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: orders trucking_orders_cancelled_by_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.orders
    ADD CONSTRAINT trucking_orders_cancelled_by_foreign FOREIGN KEY (cancelled_by) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: orders trucking_orders_client_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.orders
    ADD CONSTRAINT trucking_orders_client_id_foreign FOREIGN KEY (client_id) REFERENCES trucking.clients(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: orders trucking_orders_client_truck_company_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.orders
    ADD CONSTRAINT trucking_orders_client_truck_company_id_foreign FOREIGN KEY (client_truck_company_id) REFERENCES trucking.client_truck_companies(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: orders trucking_orders_reference_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.orders
    ADD CONSTRAINT trucking_orders_reference_id_foreign FOREIGN KEY (reference_id) REFERENCES trucking.orders(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: route_locations trucking_route_locations_location_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.route_locations
    ADD CONSTRAINT trucking_route_locations_location_id_foreign FOREIGN KEY (location_id) REFERENCES trucking.locations(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: route_locations trucking_route_locations_route_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.route_locations
    ADD CONSTRAINT trucking_route_locations_route_id_foreign FOREIGN KEY (route_id) REFERENCES trucking.routes(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trips trucking_trips_order_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.trips
    ADD CONSTRAINT trucking_trips_order_id_foreign FOREIGN KEY (order_id) REFERENCES trucking.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: trips trucking_trips_route_reference_id_foreign; Type: FK CONSTRAINT; Schema: trucking; Owner: -
--

ALTER TABLE ONLY trucking.trips
    ADD CONSTRAINT trucking_trips_route_reference_id_foreign FOREIGN KEY (route_reference_id) REFERENCES trucking.routes(id) ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: approvals warehouse_approvals_approver_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.approvals
    ADD CONSTRAINT warehouse_approvals_approver_id_foreign FOREIGN KEY (approver_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: items warehouse_items_division_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.items
    ADD CONSTRAINT warehouse_items_division_id_foreign FOREIGN KEY (division_id) REFERENCES master.divisions(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: procurement_requests warehouse_procurement_requests_item_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.procurement_requests
    ADD CONSTRAINT warehouse_procurement_requests_item_id_foreign FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: procurement_requests warehouse_procurement_requests_quotation_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.procurement_requests
    ADD CONSTRAINT warehouse_procurement_requests_quotation_id_foreign FOREIGN KEY (quotation_id) REFERENCES warehouse.procurement_quotations(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: procurement_requests warehouse_procurement_requests_requester_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.procurement_requests
    ADD CONSTRAINT warehouse_procurement_requests_requester_id_foreign FOREIGN KEY (requester_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_alerts warehouse_stock_alerts_item_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.stock_alerts
    ADD CONSTRAINT warehouse_stock_alerts_item_id_foreign FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_alerts warehouse_stock_alerts_last_requisition_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.stock_alerts
    ADD CONSTRAINT warehouse_stock_alerts_last_requisition_id_foreign FOREIGN KEY (last_requisition_id) REFERENCES warehouse.stock_requisitions(id) ON UPDATE CASCADE ON DELETE SET NULL;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_requisitions warehouse_stock_requisitions_item_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.stock_requisitions
    ADD CONSTRAINT warehouse_stock_requisitions_item_id_foreign FOREIGN KEY (item_id) REFERENCES warehouse.items(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
--> statement-breakpoint

-- Name: stock_requisitions warehouse_stock_requisitions_requester_id_foreign; Type: FK CONSTRAINT; Schema: warehouse; Owner: -
--

ALTER TABLE ONLY warehouse.stock_requisitions
    ADD CONSTRAINT warehouse_stock_requisitions_requester_id_foreign FOREIGN KEY (requester_id) REFERENCES master.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
--> statement-breakpoint

--
-- PostgreSQL database dump complete
--
--> statement-breakpoint
