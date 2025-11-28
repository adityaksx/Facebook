// ============================================
// CONFIGURATION & GLOBAL STATE
// ============================================

// Supabase client
const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Data configuration
const JSON_DATA_FOLDER = 'facebook_json_data';
const AVAILABLE_YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Pagination
const POSTS_PER_PAGE = 10;

// Translation rate limiting
const MAX_TRANSLATIONS_PER_MINUTE = 10;

// Global state variables
let allPosts = [];
let filteredPosts = [];
let currentPage = 0;
let translationRequestCount = 0;
let isAdmin = false;
let currentUser = null;

// Translation cache
const translationCache = {};

// Like progress tracker
const likeInProgress = new Set();

console.log('✅ Config loaded');
