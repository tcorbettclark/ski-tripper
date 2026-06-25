import { aboutContent } from './about-content'
import StyledMarkdown from './StyledMarkdown'
import { srOnly } from './theme'

export default function LandingSeoContent() {
  return (
    <section aria-label="About Ski Tripper" style={srOnly}>
      <StyledMarkdown>{aboutContent}</StyledMarkdown>
    </section>
  )
}
