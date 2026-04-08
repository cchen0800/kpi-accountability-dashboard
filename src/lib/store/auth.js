import { atom } from 'jotai'

export const authTokenAtom = atom(localStorage.getItem('auth_token') || '')
export const authRequiredAtom = atom(null) // null = unknown, true/false after check
