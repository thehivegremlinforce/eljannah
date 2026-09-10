// Presenter copy for the illustrative employee, manager and store-network journey.
// Button sequences describe the sample walkthrough; the live click coach guides each action.
export const presenterOpening = {
  problem: 'Store teams need a clear next step when updates, issues and decisions sit in different places.',
  say: 'We’re looking at how Slack could be the work OS for every connected El Jannah store. The goal is to make it clear what needs attention, who owns it and where the next shift can find the context. We’ll start with Omar on the floor, follow the work to Sarah as manager, then look across the stores.',
};

export const crewPresenter = {
  access: {
    problem: 'Getting the shift brief should not depend on having a corporate email address.',
    say: 'Omar starts with an employee ID and a security check. The crew can reach their assigned workspace without a corporate email address.',
    click: 'The employee sign-in is already open. Use Employee ID EJ-014, select Continue, then Approve sign-in.',
  },
  channels: {
    problem: 'A busy crew needs relevant updates without searching a whole company workspace.',
    say: 'Omar has ten assigned channels, with the store conversation close at hand. The business manages the channel set so the crew can focus on the shift.',
    click: 'Open #store-bankstown from Slack’s channel list.',
  },
  clips: {
    problem: 'People starting at different times still need the same shift briefing.',
    say: 'Layla’s short briefing is ready when Omar is. He can watch the captioned clip or read the transcript, and the next crew can catch up in the same place.',
    click: 'Play the 12-second briefing, then Briefing watched. Continue. Or open the transcript and select I’ve read the briefing.',
  },
  canvas: {
    problem: 'The crew needs one place to find the current brief, contacts and procedure links.',
    say: 'The Store Hub brings today’s essentials together in a canvas the crew can read. People records and approved procedures stay in their source systems, with the right links here.',
    click: 'Read the Store Hub, then select Store brief read.',
  },
  lists: {
    problem: 'Tasks are hard to follow when the owner and current status are unclear.',
    say: 'Omar can see the shift tasks, who owns them and what still needs attention. The list is view-only for the crew, with approved workflows available to record a check.',
    click: 'Read the owners and status, then select I’ve read the task list.',
  },
  shifts: {
    problem: 'Schedule questions and open-shift requests need a clear approval path.',
    say: 'Omar can see his shift, request an open shift and clock in through the workforce app. A request still needs Sarah’s approval, and the roster and time record stay with that app.',
    click: 'Review the schedule, then Clock in. Before clocking in, you can optionally try View open shifts, Request this shift and Back to my shift.',
  },
  workflows: {
    problem: 'An issue raised on the floor needs enough context and a named owner.',
    say: 'Omar has noticed garlic sauce tubs being missed at the packing bench. This approved form sends the details to Sarah and keeps the request visible in the store channel.',
    click: 'Review or edit the packing issue, then select Submit issue.',
  },
  huddles: {
    problem: 'A quick conversation needs an agreed next step that the rest of the team can find.',
    say: 'Omar, Layla and Sarah talk through the reported issue. The useful part is what stays afterwards: the issue, the agreed packing check and the follow-up in the channel.',
    click: 'Sarah’s huddle invitation appears. Choose Join, then Keep the agreed action in the channel.',
  },
  agents: {
    problem: 'Routine questions can interrupt the shift when people do not know where to look.',
    say: 'Omar asks the approved store guide how to request shift cover. The reply points him to the workflow and its approval path, and stays in the channel for the team.',
    click: 'Ask the approved agent, read its reply, then Keep the answer in the channel.',
  },
  governance: {
    problem: 'Crew access needs clear boundaries while store work carries into the next shift.',
    say: 'Omar can work in his assigned channels, with external direct messages and Slack Connect restricted for this frontline role. He clocks out through the workforce app, while the store keeps the issue and agreed action for the next crew.',
    click: 'Try External direct message, then Clock out. You can also check Slack Connect before clocking out.',
  },
};

export const managerPresenter = {
  complaints: {
    problem: 'Related guest complaints can be easy to miss when they arrive through different channels.',
    say: 'Sarah sees three missing-item reports brought together as one pattern. She can give the packing check an owner, then keep the follow-up with the original reports.',
    click: 'Assign the packing check, then Record a resolved follow-up.',
  },
  'drive-thru': {
    problem: 'A queue alert needs store context and a practical response.',
    say: 'The ticket time sits beside this store’s target and comparison window. Sarah can review the suggested rush playbook and coordinate a response with the shift leader.',
    click: 'Assign the rush playbook, then Record a resolved follow-up.',
  },
  delivery: {
    problem: 'A paused delivery channel needs a readiness check and a clear decision owner.',
    say: 'The delivery pause arrives with its duration and estimated trading impact. Sarah owns the stock and packing readiness check before anyone decides to resume the channel.',
    click: 'Assign the availability check, then Record a resolved follow-up.',
  },
  refunds: {
    problem: 'A rise in order errors needs a specific packing check and a follow-up.',
    say: 'The errors point to the items appearing most often in the reports. Sarah can focus the packing check on those items and keep the next review with the action.',
    click: 'Assign an order accuracy check, then Record a resolved follow-up.',
  },
  sales: {
    problem: 'A trading update needs to arrive while the store still has time to respond.',
    say: 'This example returns to a 2 pm trading checkpoint, with sales compared against forecast and the comparable day last year. Sarah can check availability and channel mix, then give the remaining trading period one useful focus.',
    click: 'Assign today’s trading focus, then Record a resolved follow-up.',
  },
  diagnostics: {
    problem: 'A manager needs the evidence behind a change before choosing a response.',
    say: 'The approved diagnostics example brings channel mix, availability and guest feedback together. The pattern suggests where Sarah should investigate; she still checks the evidence and owns the decision.',
    click: 'Assign the diagnostic follow-up, then Record a resolved follow-up.',
  },
  'weekly-pack': {
    problem: 'The weekly review needs to carry unfinished work forward as well as show the scorecard.',
    say: 'Karim’s Monday pack pairs the store’s priority metrics with its outstanding actions. That gives Sarah a clear weekly focus and keeps last week’s commitments in view.',
    click: 'Assign the weekly store focus, then Record a resolved follow-up.',
  },
  leaderboard: {
    problem: 'A ranking change needs an explanation and an offer of practical support.',
    say: 'The ranking drop comes with the metric behind it and a matching packing playbook. Sarah and Karim can agree on the response and the next review together.',
    click: 'Assign the improvement playbook, then Record a resolved follow-up.',
  },
  'follow-up': {
    problem: 'An unresolved complaint needs to keep moving without losing its owner or history.',
    say: 'The complaint is still open after 48 hours. Sarah sends the reminder, then escalates it to Karim with the original owner and history attached.',
    click: 'Send the 48-hour reminder, then Escalate to Karim.',
  },
  review: {
    problem: 'A guest response needs a person to check the wording before approving it.',
    say: 'Sarah reads the proposed response beside the review and can edit it before approval. The approved wording stays with the manager’s decision.',
    click: 'Review or edit the response, then Approve this draft.',
  },
};

export const presenterClosing = {
  problem: 'Area managers need context across stores while each store keeps a clear local owner.',
  say: 'The same approach connects a crew question, a manager’s decision and the area view. Slack is the work OS for every connected store, with the conversation and next step together while the original records stay in their source systems. From here, we can choose the first store signals and approvals El Jannah would want to connect.',
  click: 'Open the store network. Select a store card to return to its local context.',
};
