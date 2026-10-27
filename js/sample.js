/* Sample village for exploring without signing in. Firms and people are made up. */
'use strict';
window.SAMPLE_DATA = function () {
  const now = Date.now(), ago = h => new Date(now - h * 3600e3).toISOString();
  const houses = {
    hq:     { id: 'hq', name: 'Allocation HQ', bot: 'Allocator', role: 'Public credit news', brain_provider: 'anthropic', brain_model: 'claude-opus-5-5', status: 'idle', current_task: 'Next scan at 6:15', last_run_at: ago(20) },
    tavern: { id: 'tavern', name: 'The Tavern', bot: 'Rolodex', role: 'Networking: people worth knowing', brain_provider: 'anthropic', brain_model: 'claude-opus-5-5', status: 'idle', current_task: 'Next: a comment on Sample Credit Weekly', last_run_at: ago(5) },
    dojo:   { id: 'dojo', name: 'Interview Dojo', bot: 'Sensei', role: 'Prep for the platform job search', brain_provider: 'anthropic', brain_model: 'claude-opus-5-5', status: 'idle', current_task: 'Next: likely questions for Birch', last_run_at: ago(3) },
    tailor: { id: 'tailor', name: 'The Tailor', bot: 'Tailor', role: 'Resume versions for each firm', brain_provider: 'anthropic', brain_model: 'claude-opus-5-5', status: 'idle', current_task: 'Waiting on your review of Alder v1', last_run_at: ago(2) },
    print:  { id: 'print', name: 'Print Shop', bot: 'Editor', role: 'Covenant Lite on Substack', brain_provider: 'anthropic', brain_model: 'claude-opus-5-5', status: 'working', current_task: 'Drafting Sunday\'s issue', last_run_at: ago(1) },
    crier:  { id: 'crier', name: 'Town Crier', bot: 'Crier', role: 'Covenant Lite on X', brain_provider: 'anthropic', brain_model: 'claude-opus-5-5', status: 'idle', current_task: 'Next scan at noon', last_run_at: ago(4) },
    vault:  { id: 'vault', name: 'The Vault', bot: 'Steward', role: 'Investment ideas for two backers', brain_provider: 'anthropic', brain_model: 'claude-opus-5-5', status: 'idle', current_task: 'Memo #1 outline', last_run_at: ago(30) },
    well:   { id: 'well', name: 'Wildcard Well', bot: 'The Well', role: 'Long shots from across the village', brain_provider: 'anthropic', brain_model: 'claude-opus-5-5', status: 'idle', current_task: 'Next draw on Friday', last_run_at: ago(70) },
  };
  const goals = [
    { id: 'x-followers', house_id: 'crier', title: 'Reach 5,000 followers on X', unit: 'followers', start_value: 500, current_value: 550, target_value: 5000, deadline_label: 'by Oct 31, 2027', pace_note: 'Needs about 84 new followers a week.', behind: false, phases: [{ name: 'Base', weeks: 'Weeks 1–6', focus: '10 good replies a day, 1 original post a day.', now: true }], milestones: ['1,000 by Dec 31', '2,500 by Apr 30'], sort: 1 },
    { id: 'substack-subs', house_id: 'print', title: 'Reach 5,000 Substack subscribers', unit: 'subscribers', start_value: 3877, current_value: 3877, target_value: 5000, deadline_label: 'by Mar 31, 2027', pace_note: 'Behind: no issue in 7 months; needs about 50 a week.', behind: true, phases: [{ name: 'Base', weeks: 'Weeks 1–4', focus: 'Never miss the Sunday issue.', now: true }], milestones: ['4,250 by Nov 30', '4,600 by Jan 31', '5,000 by Mar 31'], sort: 3 },
    { id: 'defined-seat', house_id: 'dojo', title: 'Sign a defined seat: mandate, reporting line, economics', unit: 'signed seat', start_value: 0, current_value: 0, target_value: 1, deadline_label: 'by Mar 31, 2027', pace_note: null, behind: false, phases: [{ name: 'Convert', weeks: 'Oct–Nov', focus: 'A role conversation at each active platform.', now: true }, { name: 'Define', weeks: 'Dec–Jan', focus: 'Mandate and economics in writing.' }, { name: 'Close', weeks: 'Feb–Mar', focus: 'Offer and exit logistics.' }], milestones: [], sort: 4 },
    { id: 'network-connections', house_id: 'tavern', title: 'Turn networking targets into real two-way connections', unit: 'connections', start_value: 0, current_value: 1, target_value: 5, deadline_label: 'by Mar 31, 2027', pace_note: null, behind: false, phases: [{ name: 'Earn it', weeks: 'Ongoing', focus: 'Useful public touches until they engage.', now: true }], milestones: [], sort: 5 },
    { id: 'resume-coverage', house_id: 'tailor', title: 'A tailored resume for every live process', unit: 'versions live', start_value: 0, current_value: 1, target_value: 1, deadline_label: 'within 48 hours of each new process', pace_note: null, behind: false, phases: [], milestones: [], sort: 6 },
    { id: 'second-meeting', house_id: 'vault', title: 'Take one idea to a second meeting', unit: 'second meetings', start_value: 0, current_value: 0, target_value: 1, deadline_label: 'by Mar 31, 2027', pace_note: null, behind: false, phases: [{ name: 'Generate', weeks: 'Weeks 1–8', focus: 'One memo every two weeks.', now: true }], milestones: [], sort: 7 },
  ];
  let sid = 1;
  const sets = [
    ['x-followers', 'Replies to accounts over 10k', 12, 70], ['x-followers', 'Original posts', 1, 7],
    ['substack-subs', 'Issue published', 0, 1], ['defined-seat', 'Mock pitches or interviews', 1, 2], ['defined-seat', 'Useful touches into target firms', 2, 3],
    ['network-connections', 'Public touches on targets', 1, 3], ['second-meeting', 'Open questions closed', 0, 5],
  ].map(([goal_id, name, done, weekly_target]) => ({ id: sid++, goal_id, name, done, weekly_target }));
  const approvals = [
    { id: 's1', house_id: 'crier', kind: 'x_reply', status: 'pending', title: 'Reply to @sample_credit: ABF spreads held up better than direct lending', meta: 'Fit: high. Fresh post, 40k followers, no replies yet.', target: 'https://x.com/', draft: 'Insurance balance sheets are bidding for senior ABF in a way they aren\'t for sponsor loans. That\'s most of the gap.', created_at: ago(2) },
    { id: 's2', house_id: 'dojo', kind: 'memo', status: 'pending', title: 'Alder pitch tune-up: role conversation before mid-November', meta: 'Prep only', target: 'Staten (prep only)', draft: 'Why now\nThe November meeting is the deadline. The aim is to name a seat.\n\nWhat to say out loud\n"You\'re already allocating to outside managers through SMAs. I\'d own the layer above that."\n\nObjection to expect\n"Can\'t the team source co-invest itself?"', created_at: ago(3) },
    { id: 's3', house_id: 'tailor', kind: 'resume', status: 'pending', title: 'Alder resume v1', meta: 'Aimed at the seat in the Dojo\'s Alder status line.', draft: '1. Header: "Target: strategic transactions / private credit / special projects"\n2. Lead with scale: 11 managers, $2.5bn.\n3. Move the GP-economics bullet up.', created_at: ago(2) },
    { id: 's4', house_id: 'print', kind: 'issue', status: 'approved', title: 'Draft: The Quiet Bid for Senior ABF', meta: 'Approved Friday', draft: 'Sample issue text.', created_at: ago(60), decided_at: ago(30) },
    { id: 's6', house_id: 'crier', kind: 'x_reply', status: 'approved', title: 'Reply to @sample_rates: warehouse lines are the tell', meta: 'Fit: high. 55k followers.', target: 'https://x.com/', draft: 'Advance rates on warehouse lines moved before spreads did. That is the tell.', created_at: ago(30), decided_at: ago(26) },
    { id: 's7', house_id: 'crier', kind: 'x_post', status: 'approved', title: 'Post: three numbers on insurance-owned ABF', meta: 'Original post', draft: 'Three numbers on insurance-owned ABF this year.', created_at: ago(56), decided_at: ago(50), shipped_at: ago(48), shipped_url: 'https://x.com/' },
    { id: 's8', house_id: 'crier', kind: 'lesson', status: 'pending', title: 'Lesson: Lead each reply with one number from a source found this run.', meta: 'Evidence: the 2 replies with a number got 3x the likes of the 4 without.', draft: 'Lead each reply with one number from a source found this run.', created_at: ago(20) },
    { id: 's9', house_id: 'print', kind: 'lesson', status: 'approved', title: 'Lesson: Put the thesis in the first line of every outline.', meta: 'Evidence: both outlines sent back for a buried thesis.', draft: 'Put the thesis in the first line of every outline.', created_at: ago(200), decided_at: ago(190) },
    { id: 's5', house_id: 'tavern', kind: 'other', status: 'pending', title: 'Comment on Sample Credit Weekly: "Tightening by proxy"', meta: 'Substack comment', target: 'https://example.com/', draft: 'The proxy here is warehouse advance rates. They moved two points before spreads did.', created_at: ago(6) },
  ];
  const activity = [
    ['dojo', 3, 'Status (Alder Capital): active; camp = convert; seat = strategic transactions / private credit / special projects; who = A. Alder (co-CIO), M. Reyes; next = role conversation before Nov 15'],
    ['dojo', 3, 'Status (Birch Family Office): active; camp = define; seat = structured capital unit; who = R. Birch; next = send the pre-agreed plan'],
    ['dojo', 3, 'Status (Elm Point): active; camp = convert; seat = JV and origination partnerships; who = T. Elm; next = first note not sent yet'],
    ['dojo', 3, 'Status (Cedar Partners): periodic; camp = foothills; seat = private credit platform build; who = L. Cedar; next = check in late January'],
    ['dojo', 3, 'Status (Dune Capital): keep-warm; camp = foothills; seat = global equities BD lead (passed); who = K. Dune; next = when a credit seat opens'],
    ['dojo', 3, 'Lesson (Alder Capital): state the seat and the ask in the first five minutes'],
    ['dojo', 3, 'Lesson (Birch Family Office): lead with junior capital and seeding; keep direct lending out'],
    ['dojo', 4, 'Queued Alder pitch tune-up memo'],
    ['tailor', 2, 'Queued Alder resume v1: seat from the Dojo status line'],
    ['crier', 4, 'Added 3 radar items with 1 draft reply'],
    ['print', 1, 'Outline started: The Quiet Bid for Senior ABF, part 2'],
    ['tavern', 6, 'Drafted a comment on Sample Credit Weekly'],
    ['hq', 20, 'Logged 4 public credit items: two fund closes, a ratings action, a delinquency print'],
    ['vault', 30, 'Started memo #1: a forward-flow platform'],
    ['well', 70, 'Suggested 2 long shots tied to the Print Shop and the Crier'],
  ].map(([house_id, h, text], i) => ({ id: 'a' + i, house_id, at: ago(h), text, source: 'agent' }));
  const radar = [
    { id: 'r1', source: 'following', fit: 'high', author_handle: 'sample_credit', author_followers: 40000, post_text: 'ABF spreads held up better than direct lending this year. Why?', why: 'Fresh, big account, squarely your subject.', post_url: 'https://x.com/', status: 'drafted', found_at: ago(2) },
    { id: 'r2', source: 'search', fit: 'low', author_handle: 'big_news', author_followers: 2000000, post_text: 'Feature on retail investors and private credit.', why: 'Huge reach, weak fit.', post_url: 'https://x.com/', status: 'new', found_at: ago(2) },
  ];
  const wild = [
    { id: 'w1', person: 'Sample Writer', role: 'A large finance newsletter', from_houses: ['print'], why: 'A guest piece would move the subscriber goal fastest.', route: 'The contact page on their newsletter.', draft: 'I write Covenant Lite on private credit and ABF. I have a piece on insurance capital that might fit as a guest post.', status: 'new', created_at: ago(70) },
  ];
  const readings = [['x-followers', 520, 480], ['x-followers', 538, 216], ['x-followers', 550, 30], ['substack-subs', 3877, 216]]
    .map(([goal_id, value, h], i) => ({ id: 'g' + i, goal_id, value, at: ago(h), source: 'you' }));
  // a made-up base resume and one tailored version, linked to the Tailor's draft (s3)
  const base = { name: 'Sample Person, CFA', contact: ['New York, NY', 'sample@example.com', '(555) 010-0100'], sections: [
    { id: 'experience', title: 'Experience', items: [
      { id: 'i1', parts: ['Director, Manager Research', 'Example Asset Management', 'Jan 2019 – Present'], entries: [
        { id: 'e1', level: 0, text: 'Covers private credit managers for a multi-asset allocation platform' },
        { id: 'e2', level: 0, text: 'External manager allocation', bold: true },
        { id: 'e3', level: 1, text: 'Ran diligence on 60 private credit managers across direct lending and asset-based finance' },
        { id: 'e4', level: 1, text: 'Built the team’s manager scoring framework' },
        { id: 'e5', level: 0, text: 'Co-investments', bold: true },
        { id: 'e6', level: 1, text: 'Underwrote co-investments alongside managers in specialty finance' },
        { id: 'e7', level: 1, text: 'Presented recommendations to the investment committee' } ] },
      { id: 'i2', parts: ['Co-Investment Analyst', 'Example Pension Fund', 'Feb 2015 – Dec 2018'], entries: [
        { id: 'e8', level: 0, text: 'Sourced and diligenced private equity co-investments' },
        { id: 'e9', level: 0, lead: 'Deal work:', text: 'supported diligence on credit and equity co-investments' } ] } ] },
    { id: 'education', title: 'Education', items: [
      { id: 'i3', parts: ['English', 'May 2012', 'Example College'], entries: [{ id: 'e10', level: 0, text: 'Minor: Economics' }] },
      { id: 'i4', parts: ['CFA', 'June 2015', 'CFA Institute'], entries: [{ id: 'e11', level: 0, text: 'Charterholder' }] } ] } ] };
  const v1 = JSON.parse(JSON.stringify(base));
  const ex = v1.sections[0].items[0].entries;
  v1.sections[0].items[0].entries = [ex[0], ex[4], { ...ex[5], text: 'Underwrote co-investments alongside managers in specialty finance and asset-based lending' }, ex[6], ex[1], ex[2],
    { id: 'n1', level: 1, text: 'Writes a weekly specialty finance newsletter read by 3,877 subscribers', added: true }];
  const resumes = [
    { id: 'r1', firm: null, version: 1, content: base, status: 'base', created_by: 'import', created_at: ago(400), changes: [], comments: [] },
    { id: 'r2', firm: 'Alder Capital', seat: 'strategic transactions / private credit / special projects', version: 1, based_on: 'r1', content: v1, status: 'pending', created_by: 'tailor', created_at: ago(2),
      summary: 'Leads with co-investment underwriting, which is what the special projects seat needs. Moves allocation work below it and adds the newsletter.',
      changes: [{ entry: 'e5', kind: 'moved', why: 'The seat wants underwriting first.' }, { entry: 'e6', kind: 'reworded', why: 'Names asset-based lending, from the Dojo’s Alder lesson.' },
        { entry: 'e4', kind: 'cut', why: 'Process detail the seat doesn’t need.' }, { entry: 'n1', kind: 'added', why: 'From your record: Covenant Lite.' }], comments: [] } ];
  approvals.find(a => a.id === 's3').resume_id = 'r2';
  const record = [
    { id: 1, house_id: 'tailor', name: 'resume.md', body: '# Sample Person, CFA\n\nMade-up record for the sample village.', updated_at: ago(400), updated_by: 'import' },
    { id: 2, house_id: 'print', name: 'voice.md', body: '# Voice\n\n- Direct, specific, numerate.\n- No hype.', updated_at: ago(300), updated_by: 'import' } ];
  return { houses, goals, sets, approvals, activity, radar, wild, readings, resumes, record };
};
