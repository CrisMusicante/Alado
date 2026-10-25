/**
 * Shapes a `setlist_items JOIN songs` row into the { song, position, custom_video } item the
 * renderer's SavedSetlist expects. The song's id is song_id (the row's own id is the item's).
 */
export function toSetlistItem(row: any): { position: number; custom_video: string | null; song: any } {
  return {
    position: row.position,
    custom_video: row.custom_video ?? null,
    song: {
      id: row.song_id,
      title: row.title,
      artist: row.artist,
      video_path: row.video_path,
      sections: JSON.parse(row.sections || '[]'),
      text_style: JSON.parse(row.text_style || '{}')
    }
  }
}
