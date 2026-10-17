import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildSite } from "../../build.mjs";
import { PUBLIC_FILES, contentType } from "../../scripts/public-files.mjs";
import { cacheControl, readArtifactManifest } from "../../scripts/artifact.mjs";
const project = fileURLToPath(new URL("../..", import.meta.url));

export async function deployFixture(t, alter = () => {}) {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-deploy-")), root = join(directory, "checkout"), bin = join(directory, "bin");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(root); await mkdir(bin);
  const files = [...PUBLIC_FILES, "build.mjs", "data/projects.mjs", ...((await readdir(join(project, "scripts"))).filter(file => /\.(?:mjs|sh)$/.test(file)).map(file => `scripts/${file}`))];
  for (const file of files) { await mkdir(dirname(join(root, file)), { recursive: true }); await copyFile(join(project, file), join(root, file)); }
  // The orchestration test never uses fetch. Byte/cache/redirect verification has
  // its own full fake-HTTP suite; this stub returns the already verified artifact.
  await writeFile(join(root, "scripts/verify-live.mjs"), 'import {verifySite} from "./verify-site.mjs"; console.log(JSON.stringify(await verifySite(process.argv[2])));\n');
  await writeFile(join(root, ".gitignore"), "dist/\ndist.manifest.json\n.deployments/\n");
  const git = (...args) => { const result = spawnSync("git", args, { cwd: root, encoding: "utf8" }); if (result.status) throw new Error(result.stderr); return result.stdout.trim(); };
  git("init", "-q"); git("add", "."); git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture");
  const sha = git("rev-parse", "HEAD");
  await buildSite({ root });
  const manifest = await readArtifactManifest(join(root, "dist"));
  const state = { objects: {}, events: [] };
  for (const [source, entry] of Object.entries(manifest.assets)) state.objects[entry.path] = {
    VersionId: "prior-" + entry.sha256.slice(0, 8), ETag: '"' + entry.sha256.slice(0, 32) + '"',
    ChecksumSHA256: Buffer.from(entry.sha256, "hex").toString("base64"),
    ContentType: contentType(source), CacheControl: cacheControl(entry.path), LastModified: "2026-10-17T00:00:00Z",
  };
  alter(state, manifest);
  const stateFile = join(directory, "state.json"); await writeFile(stateFile, JSON.stringify(state));
  const mock = `#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path=process.env.MOCK_AWS_STATE, state=JSON.parse(readFileSync(path,'utf8')), args=process.argv.slice(2);
const value=name=>args[args.indexOf(name)+1], key=value('--key'), op=args[1];
const reply=result=>{writeFileSync(path,JSON.stringify(state)); if(result) process.stdout.write(JSON.stringify(result));};
state.events.push({service:args[0],op,key,args});
if(args[0]==='sts'&&op==='get-caller-identity') reply({Account:'247222972014',Arn:'arn:aws:sts::247222972014:assumed-role/test/session'});
else if(op==='get-bucket-versioning') reply({Status:'Enabled'});
else if(op==='head-object'){reply(state.objects[key]); if(!state.objects[key]) process.exit(1);}
else if(op==='list-objects-v2'){const prefix=value('--prefix');reply({Name:'elliottbarnes.ca',Prefix:prefix,MaxKeys:1,IsTruncated:false,KeyCount:state.objects[prefix]?1:0,Contents:state.objects[prefix]?[{Key:prefix}]:[]});}
else if(op==='put-object'){
  if(state.failKey===key){reply();process.exit(9);}
  const prior=state.objects[key];
  if(prior ? value('--if-match')!==prior.ETag : value('--if-none-match')!=='*'){reply();process.exit(10);}
  const checksum=createHash('sha256').update(readFileSync(value('--body'))).digest('base64');
  if(checksum!==value('--checksum-sha256')){reply();process.exit(11);}
  state.objects[key]={VersionId:'new-'+state.events.length,ETag:'"new"',ChecksumSHA256:checksum,ContentType:value('--content-type'),CacheControl:value('--cache-control')};
  reply(state.objects[key]);
}
else if(op==='create-invalidation') reply({Invalidation:{Id:'test-invalidation'}});
else if(op==='wait') reply();
else {reply();process.stderr.write('Unexpected AWS operation '+args.join(' '));process.exit(99);}
`;
  await writeFile(join(bin, "aws"), mock); await chmod(join(bin, "aws"), 0o755);
  const result = spawnSync("bash", ["scripts/deploy.sh", sha], { cwd: root, encoding: "utf8", timeout: 120_000,
    env: { ...process.env, PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}`, MOCK_AWS_STATE: stateFile } });
  const finalState = JSON.parse(await readFile(stateFile, "utf8"));
  const runs = await readdir(join(root, ".deployments"));
  const record = JSON.parse(await readFile(join(root, ".deployments", runs[0], "deployment-record.json"), "utf8"));
  return { ...result, state: finalState, record, manifest };
}
