import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import * as fs from 'fs';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) throw new Error('GitHub not connected');
  return accessToken;
}

async function main() {
  const repoName = process.argv[2] || 'luminawealth';

  console.log('Getting GitHub access token...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  console.log(`Authenticated as: ${owner}`);

  let isEmpty = false;
  try {
    const { data: existingRepo } = await octokit.repos.get({ owner, repo: repoName });
    isEmpty = existingRepo.size === 0;
    console.log(`Repository ${owner}/${repoName} exists${isEmpty ? ' (empty)' : ''}.`);
  } catch (e: any) {
    if (e.status === 404) {
      console.log(`Creating repository ${repoName}...`);
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: 'Lumina Wealth - Books & Courses Marketplace Platform',
        private: false,
      });
      isEmpty = true;
      console.log(`Repository created.`);
      await new Promise(r => setTimeout(r, 3000));
    } else throw e;
  }

  if (isEmpty) {
    console.log('Initializing empty repository with README...');
    await octokit.repos.createOrUpdateFileContents({
      owner, repo: repoName,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from('# Lumina Wealth\n\nBooks & Courses Marketplace Platform\n').toString('base64'),
    });
    console.log('Repository initialized.');
    await new Promise(r => setTimeout(r, 3000));
  }

  const trackedFiles = execSync(
    'git ls-files --cached',
    { cwd: '/home/runner/workspace', encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
  ).trim().split('\n').filter(f => f.trim());

  const SKIP_PATTERNS = [
    /^\.git\//,
    /^node_modules\//,
    /^dist\//,
    /^\.cache\//,
    /^scripts\/push-to-github/,
    /\.log$/,
  ];

  const filesToPush = trackedFiles.filter(f => !SKIP_PATTERNS.some(p => p.test(f)));
  console.log(`Pushing ${filesToPush.length} files...`);

  let refSha: string;
  let branchName = 'main';
  try {
    const { data: ref } = await octokit.git.getRef({ owner, repo: repoName, ref: 'heads/main' });
    refSha = ref.object.sha;
  } catch {
    const { data: ref } = await octokit.git.getRef({ owner, repo: repoName, ref: 'heads/master' });
    refSha = ref.object.sha;
    branchName = 'master';
  }

  const BATCH_SIZE = 15;
  const treeItems: any[] = [];
  let processed = 0;

  for (let i = 0; i < filesToPush.length; i += BATCH_SIZE) {
    const batch = filesToPush.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (filePath) => {
      try {
        const fullPath = `/home/runner/workspace/${filePath}`;
        const content = fs.readFileSync(fullPath);
        const base64Content = content.toString('base64');

        if (content.length > 50 * 1024 * 1024) {
          console.log(`  Skipping ${filePath} (too large)`);
          return null;
        }

        const { data: blob } = await octokit.git.createBlob({
          owner, repo: repoName,
          content: base64Content,
          encoding: 'base64',
        });

        return {
          path: filePath,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      } catch (err: any) {
        console.log(`  Skipping ${filePath}: ${err.message?.slice(0, 80)}`);
        return null;
      }
    }));

    treeItems.push(...results.filter(Boolean));
    processed += batch.length;
    if (processed % 60 === 0 || processed >= filesToPush.length) {
      console.log(`  Progress: ${Math.min(processed, filesToPush.length)}/${filesToPush.length} files`);
    }
  }

  console.log(`Creating tree with ${treeItems.length} files...`);
  const { data: newTree } = await octokit.git.createTree({
    owner, repo: repoName,
    tree: treeItems,
  });

  console.log('Creating commit...');
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo: repoName,
    message: 'Lumina Wealth - Full application code\n\nBooks & Courses marketplace platform with Paynow payment integration,\nGoogle OAuth, admin dashboard, course creation with quizzes/labs/certificates,\nebook publishing, and PWA offline support.',
    tree: newTree.sha,
    parents: [refSha],
  });

  console.log('Updating branch...');
  await octokit.git.updateRef({
    owner, repo: repoName,
    ref: `heads/${branchName}`,
    sha: newCommit.sha,
    force: true,
  });

  console.log(`\nSuccess! Your code is now on GitHub:`);
  console.log(`https://github.com/${owner}/${repoName}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
