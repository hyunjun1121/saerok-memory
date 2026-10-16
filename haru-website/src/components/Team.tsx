import { Section } from "@/components/ui/Section";
import { siteCopy } from "@/content/copy";

const MEMBER_MODIFIERS = ["a", "b", "c", "d"];

export function Team() {
  const team = siteCopy.team;
  return (
    <Section id="team" tone="soft" eyebrow={team.eyebrow} title={team.title} sub={team.sub}>
      <div className="hw-team-grid" data-reveal>
        {team.members.map((member, index) => (
          <article key={member.name} className={`hw-member hw-member--${MEMBER_MODIFIERS[index]}`}>
            <img className="hw-member__photo" src={member.photo} alt={`${member.name} 프로필 사진`} />
            <h3 className="hw-member__name">{member.name}</h3>
            <div className="hw-member__role">{member.role}</div>
            <p className="hw-member__org">{member.org}</p>
            <p className="hw-member__note">{member.note}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
