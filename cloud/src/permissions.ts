import type { Change, Role } from '../../shared/types'
import type { StoredSong } from './sync'

/** Whether `role` may apply `change`; an error code otherwise. Role rules land in Task 4. */
export function canApply(_role: Role, _change: Change, _existing: StoredSong | null): true | string {
  return true
}
