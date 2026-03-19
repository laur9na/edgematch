// src/styles/tokens.ts
// Single source of truth for all design values.
// Import from here instead of hardcoding colors, spacing, or type sizes anywhere.

export const colors = {
  primary: '#1a56db',
  primaryHover: '#1648c0',

  navy: '#0f172a',       // nav background

  // Text
  textPrimary: '#111827',   // gray-900
  textSecondary: '#6b7280', // gray-500

  // Borders
  borderDefault: '#e5e7eb', // gray-200
  borderFocus: '#1a56db',

  // Backgrounds
  bgPage: '#f9fafb',   // gray-50
  bgCard: '#ffffff',

  // States
  success: '#16a34a',  // green-600
  error: '#dc2626',    // red-600
  errorBg: '#fef2f2',  // red-50
} as const;

export const spacing = {
  cardPadding: 'p-6',
  cardPaddingCompact: 'p-4',
  sectionGap: 'gap-8',
  formFieldGap: 'space-y-4',
  buttonPaddingDefault: 'px-4 py-2',
  buttonPaddingPrimary: 'px-6 py-3',
  pageMaxWidth: 'max-w-4xl mx-auto px-4',
} as const;

export const typography = {
  pageTitle: 'text-2xl font-semibold text-gray-900',
  sectionHeader: 'text-lg font-medium text-gray-900',
  cardLabel: 'text-sm font-medium text-gray-500',
  cardValue: 'text-sm text-gray-900',
  errorText: 'text-sm text-red-600 mt-1',
} as const;

export const components = {
  card: 'bg-white border border-gray-200 rounded-lg p-6',
  cardInteractive: 'bg-white border border-gray-200 rounded-lg p-6 hover:border-[#1a56db] cursor-pointer',
  input: 'border border-gray-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  label: 'block text-sm font-medium text-gray-700 mb-1',
  buttonPrimary: 'bg-[#1a56db] hover:bg-[#1648c0] text-white rounded-md font-medium px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed',
  buttonSecondary: 'border border-gray-300 text-gray-700 bg-white rounded-md font-medium px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed',
  buttonDestructive: 'border border-red-300 text-red-600 bg-white rounded-md font-medium px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed',
} as const;
