import { backend, Storage, hash, FHE } from 'minanft-backend';

const ProgramA = ZkProgram({...})
const ProgramB = ZkProgram({...})
const storageClient = new Storage({apiKey})

await backend.uploadProgramsCode([ProgramA, ProgramB]);
const job = await backend.executeProgram({ 
    program: ProgramA,
    function: 'mint',
    arguments: {...},
    privateInputsHider: FHE,
    storage: storageClient
  });
const result = await backend.jobs.retrieve(job.id);
