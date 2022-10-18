import { vacuumJob } from '../jobs/vacuum'

export async function vacuumCommand() {
  await vacuumJob()
}
