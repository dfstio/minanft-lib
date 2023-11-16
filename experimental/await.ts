
let finished = false;

async function test1(i: number) : Promise<number>{
  console.log('start', i);
  await sleep(1000 * 5);
  console.log('end', i);
  finished = true;
  return i + 1;
}


function main() {
  console.log('start main', finished);
  const k = test1(1);
  
  (async function() {
    console.log(1)
    await sleep(1000)
    console.log(2)
    })()

  
  


console.log('end main' , finished, k);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();