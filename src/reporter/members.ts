// import mergeRequests from '../json/all-mr.json'
import fs from 'fs'
import { Types } from '@gitbeaker/node'
import { json } from '../helper'

function main() {
  const mergeRequests = json.load<Types.MergeRequestSchema[]>('all-mr.json')

  const members: { [key: string]: number } = {}
  mergeRequests.forEach((mr) => {
    const author = mr.author as Types.UserSchema
    members[author.username] ||= 0
    members[author.username]++
  })

  // 件数順ソート
  Object.keys(members)
    .sort((a, b) => members[b] - members[a])
    .forEach((member) => console.log(member, members[member]))

  console.log('total: ', mergeRequests.length)
}
main()
