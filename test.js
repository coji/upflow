const sleep = async (n) => {
  return new Promise((resolve) => setTimeout(() => resolve(), n))
}

const heavyProc = async (val) => {
  for (let n = 0; n < 5; n++) {
    await sleep(1000)
    console.log(n + 1, val)
  }
}

const main = async () => {
  let interupted = { flag: false }
  heavyProc(interupted)

  await sleep(3000)
  console.log('interuppted')
  interupted.flag = true
}

main()
