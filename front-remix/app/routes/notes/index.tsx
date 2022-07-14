import { Link } from '@remix-run/react'
import { Box } from '@chakra-ui/react'

export default function NoteIndexPage() {
  return (
    <Box>
      No note selected. Select a note on the left, or{' '}
      <Link to="new" className="text-blue-500 underline">
        create a new note.
      </Link>
    </Box>
  )
}
