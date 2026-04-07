import { get } from './core'

export const fetchEmployees = () => get('/employees')
export const fetchEmployee = (id) => get(`/employees/${id}`)
export const fetchAllUpdates = () => get('/updates')
