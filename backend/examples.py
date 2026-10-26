"""Example briefs from Alex's real conferences. Used by the 'Try an example' buttons and the official test runs."""

from models import SearchBrief

EXAMPLES: dict[str, SearchBrief] = {
    "ybec": SearchBrief(
        conference_name="Yale Business & the Environment Conference",
        conference_theme="Environmental and social regeneration: beyond sustainability",
        looking_for="panel",
        panel_theme="Circularity at scale: regenerative sourcing and supply chains",
        panel_size=3,
        conference_type="business",
        location="New Haven, CT",
        reach="national",
        budget="small",
        prioritize=["has_spoken", "range_of_perspectives"],
    ),
    "philanthropy": SearchBrief(
        conference_name="Yale Philanthropy Conference",
        conference_theme="The future we fund: who is shaping the new era of philanthropy",
        looking_for="keynote",
        conference_type="philanthropy",
        location="New Haven, CT",
        reach="national",
        budget="medium",
        prioritize=["has_spoken"],
    ),
    "trees": SearchBrief(
        conference_name="Urban Tree Summit",
        conference_theme="Shaping the future of urban forestry for greener cities and healthier communities",
        looking_for="panel",
        panel_theme="Tree equity and nature prescriptions: trees as public health infrastructure",
        panel_size=4,
        conference_type="practitioner",
        location="Washington, DC / Maryland",
        reach="regional",
        budget="small",
        prioritize=["has_spoken"],
    ),
}
