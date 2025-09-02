import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AboutSection from './About.jsx'

// Mock static assets
vi.mock('../../../../assets/app/darkProfilePic.jpg', () => ({ default: 'dark-profile.jpg' }))
vi.mock('../../../../assets/app/ftk789ProfilePic.jpg', () => ({ default: 'ftk-profile.jpg' }))
vi.mock('../../../../assets/logos/XLogo.svg?asset', () => ({ default: 'x-logo.svg' }))
vi.mock('../../../../assets/logos/kickLogoIcon.svg?asset', () => ({ default: 'kick-logo.svg' }))

describe('AboutSection Component', () => {
  const mockAppInfo = {
    appVersion: '1.2.3',
    buildDate: '2024-01-01',
    platform: 'win32',
    commit: 'abc123'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering and Initial State', () => {
    it('should render about section container', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(container.querySelector('.settingsContentAbout')).toBeInTheDocument()
    })

    it('should render main heading and description', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('About KickTalk')
      expect(screen.getByText('A chat client for Kick.com.')).toBeInTheDocument()
    })

    it('should render Meet the Creators section', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getByRole('heading', { level: 5, name: 'Meet the Creators' })).toBeInTheDocument()
    })

    it('should render About KickTalk section', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getByRole('heading', { level: 5, name: 'About KickTalk' })).toBeInTheDocument()
    })

    it('should render version information section', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getByText('Current Version:')).toBeInTheDocument()
    })
  })

  describe('Developer Information', () => {
    it('should display DRKNESS_x developer info', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getByText('DRKNESS_x')).toBeInTheDocument()
      expect(screen.getByText('Developer & Designer')).toBeInTheDocument()
      expect(screen.getByAltText('dark Profile Pic')).toBeInTheDocument()
    })

    it('should display ftk789 developer info', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getByText('ftk789')).toBeInTheDocument()
      expect(screen.getAllByText('Developer')).toHaveLength(1) // Only ftk789 has "Developer" role
      expect(screen.getByAltText('ftk789 Profile Pic')).toBeInTheDocument()
    })

    it('should display correct profile picture attributes', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const darkProfilePic = screen.getByAltText('dark Profile Pic')
      const ftkProfilePic = screen.getByAltText('ftk789 Profile Pic')
      
      expect(darkProfilePic).toHaveAttribute('src', 'dark-profile.jpg')
      expect(darkProfilePic).toHaveAttribute('width', '80')
      expect(darkProfilePic).toHaveAttribute('height', '80')
      
      expect(ftkProfilePic).toHaveAttribute('src', 'ftk-profile.jpg')
      expect(ftkProfilePic).toHaveAttribute('width', '80')
      expect(ftkProfilePic).toHaveAttribute('height', '80')
    })

    it('should display kick username labels', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const kickUsernameLabels = screen.getAllByText('Kick Username:')
      expect(kickUsernameLabels).toHaveLength(2)
    })

    it('should display role labels', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const roleLabels = screen.getAllByText('Role:')
      expect(roleLabels).toHaveLength(2)
    })

    it('should render developer separator', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(container.querySelector('.settingsContentAboutDevSeparator')).toBeInTheDocument()
    })
  })

  describe('Social Media Links', () => {
    it('should render Twitter links for both developers', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const twitterLinks = screen.getAllByText('Open Twitter')
      expect(twitterLinks).toHaveLength(2)
      
      // Check href attributes
      expect(twitterLinks[0].closest('a')).toHaveAttribute('href', 'https://x.com/drkerco')
      expect(twitterLinks[1].closest('a')).toHaveAttribute('href', 'https://x.com/ftk789yt')
    })

    it('should render Kick channel links for both developers', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const channelLinks = screen.getAllByText('Open Channel')
      expect(channelLinks).toHaveLength(2)
      
      // Check href attributes
      expect(channelLinks[0].closest('a')).toHaveAttribute('href', 'https://kick.com/drkness-x')
      expect(channelLinks[1].closest('a')).toHaveAttribute('href', 'https://kick.com/ftk789')
    })

    it('should set correct target and rel attributes for external links', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const externalLinks = screen.getAllByRole('link')
      
      externalLinks.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      })
    })

    it('should display social media icons', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const xLogos = screen.getAllByAltText('X-Twitter Logo')
      const kickLogos = screen.getAllByAltText('Kick Logo')
      
      expect(xLogos).toHaveLength(2)
      expect(kickLogos).toHaveLength(2)
      
      // Check icon attributes
      xLogos.forEach(logo => {
        expect(logo).toHaveAttribute('src', 'x-logo.svg')
        expect(logo).toHaveAttribute('width', '12')
        expect(logo).toHaveAttribute('height', '12')
      })
      
      kickLogos.forEach(logo => {
        expect(logo).toHaveAttribute('src', 'kick-logo.svg')
        expect(logo).toHaveAttribute('width', '12')
        expect(logo).toHaveAttribute('height', '12')
      })
    })

    it('should handle link clicks', async () => {
      const user = userEvent.setup()
      
      // Mock window.open to track external link clicks
      const mockOpen = vi.fn()
      global.window.open = mockOpen
      
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const twitterLink = screen.getAllByText('Open Twitter')[0].closest('a')
      
      // Note: Since these are regular anchor tags with target="_blank",
      // clicking them would normally open in a new tab. In tests, we can
      // verify the href is correct and that the link is clickable.
      expect(twitterLink).toHaveAttribute('href', 'https://x.com/drkerco')
      
      // Test that the link is interactive
      await user.hover(twitterLink)
      expect(twitterLink).toBeInTheDocument()
    })
  })

  describe('Application Information', () => {
    it('should display app description text', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const descriptionText = 'We created this application because we felt the current solution Kick was offering couldn\'t meet the needs of users who want more from their chatting experience. From multiple chatrooms to emotes and native Kick functionality all in one place.'
      
      expect(screen.getByText(descriptionText)).toBeInTheDocument()
    })

    it('should display current version when appInfo is provided', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getByText('1.2.3')).toBeInTheDocument()
    })

    it('should handle missing appVersion gracefully', () => {
      const appInfoWithoutVersion = { ...mockAppInfo, appVersion: undefined }
      
      render(<AboutSection appInfo={appInfoWithoutVersion} />)
      
      expect(screen.getByText('Current Version:')).toBeInTheDocument()
      // Should not crash when version is missing
    })

    it('should handle null appInfo gracefully', () => {
      expect(() => {
        render(<AboutSection appInfo={null} />)
      }).not.toThrow()
      
      expect(screen.getByText('Current Version:')).toBeInTheDocument()
    })

    it('should handle undefined appInfo gracefully', () => {
      expect(() => {
        render(<AboutSection appInfo={undefined} />)
      }).not.toThrow()
      
      expect(screen.getByText('Current Version:')).toBeInTheDocument()
    })

    it('should handle empty appInfo object', () => {
      expect(() => {
        render(<AboutSection appInfo={{}} />)
      }).not.toThrow()
      
      expect(screen.getByText('Current Version:')).toBeInTheDocument()
    })

    it('should display version as string when provided', () => {
      const appInfoWithStringVersion = { appVersion: '2.0.0-beta' }
      
      render(<AboutSection appInfo={appInfoWithStringVersion} />)
      
      expect(screen.getByText('2.0.0-beta')).toBeInTheDocument()
    })

    it('should handle non-string version gracefully', () => {
      const appInfoWithNumberVersion = { appVersion: 123 }
      
      expect(() => {
        render(<AboutSection appInfo={appInfoWithNumberVersion} />)
      }).not.toThrow()
      
      expect(screen.getByText('123')).toBeInTheDocument()
    })
  })

  describe('CSS Classes and Structure', () => {
    it('should apply correct CSS classes', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(container.querySelector('.settingsContentAbout')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentSection')).toBeInTheDocument()
      expect(container.querySelector('.settingsSectionHeader')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentAboutDevsContainer')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentAboutDevs')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentAboutDev')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentAboutDevInfo')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentAboutDevSections')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentAboutDevSocials')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentAboutApp')).toBeInTheDocument()
      expect(container.querySelector('.settingsContentAboutAppContent')).toBeInTheDocument()
      expect(container.querySelector('.settingsAppDetailsSection')).toBeInTheDocument()
      expect(container.querySelector('.settingsAppDetailsInfo')).toBeInTheDocument()
    })

    it('should have proper section structure', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      const sections = container.querySelectorAll('.settingsContentSection')
      expect(sections).toHaveLength(3) // Creators, App description, Version info
    })

    it('should have correct developer container structure', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      const devContainers = container.querySelectorAll('.settingsContentAboutDev')
      expect(devContainers).toHaveLength(2) // Two developers
      
      const devSeparator = container.querySelector('.settingsContentAboutDevSeparator')
      expect(devSeparator).toBeInTheDocument()
    })

    it('should have proper social links structure', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      const socialContainers = container.querySelectorAll('.settingsContentAboutDevSocials')
      expect(socialContainers).toHaveLength(2) // One for each developer
      
      // Each developer should have 2 social links
      socialContainers.forEach(container => {
        const links = container.querySelectorAll('a')
        expect(links).toHaveLength(2) // Twitter and Kick
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const h4Headings = screen.getAllByRole('heading', { level: 4 })
      const h5Headings = screen.getAllByRole('heading', { level: 5 })
      
      expect(h4Headings).toHaveLength(1) // Main "About KickTalk"
      expect(h5Headings).toHaveLength(3) // "Meet the Creators", "About KickTalk", "Current Version"
    })

    it('should have descriptive alt text for profile images', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const darkProfilePic = screen.getByAltText('dark Profile Pic')
      const ftkProfilePic = screen.getByAltText('ftk789 Profile Pic')
      
      expect(darkProfilePic).toBeInTheDocument()
      expect(ftkProfilePic).toBeInTheDocument()
    })

    it('should have descriptive alt text for social media icons', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const xLogos = screen.getAllByAltText('X-Twitter Logo')
      const kickLogos = screen.getAllByAltText('Kick Logo')
      
      expect(xLogos).toHaveLength(2)
      expect(kickLogos).toHaveLength(2)
    })

    it('should have proper link roles', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(4) // 2 Twitter + 2 Kick links
      
      links.forEach(link => {
        expect(link.tagName).toBe('A')
        expect(link).toHaveAttribute('href')
      })
    })

    it('should have descriptive link text', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getAllByText('Open Twitter')).toHaveLength(2)
      expect(screen.getAllByText('Open Channel')).toHaveLength(2)
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const links = screen.getAllByRole('link')
      
      // First link should be focusable
      await user.tab()
      expect(links[0]).toHaveFocus()
      
      // Should be able to navigate through all links
      for (let i = 1; i < links.length; i++) {
        await user.tab()
        expect(links[i]).toHaveFocus()
      }
    })

    it('should support screen readers with semantic HTML', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      // Should use proper paragraph tags
      const paragraphs = container.querySelectorAll('p')
      expect(paragraphs.length).toBeGreaterThan(0)
      
      // Should use proper headings
      const headings = container.querySelectorAll('h4, h5')
      expect(headings.length).toBeGreaterThan(0)
      
      // Should use proper spans for structured content
      const spans = container.querySelectorAll('span')
      expect(spans.length).toBeGreaterThan(0)
    })
  })

  describe('Visual Layout and Content Organization', () => {
    it('should organize developer information correctly', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      // Each developer should have their info grouped together
      const devContainers = document.querySelectorAll('.settingsContentAboutDev')
      
      devContainers.forEach(container => {
        const username = container.querySelector('h5')
        const role = container.querySelectorAll('.settingsContentAboutDevSections h5')[1]
        const socialLinks = container.querySelectorAll('.settingsContentAboutDevSocials a')
        
        expect(username).toBeInTheDocument()
        expect(role).toBeInTheDocument()
        expect(socialLinks).toHaveLength(2)
      })
    })

    it('should maintain proper visual hierarchy', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      // Main heading should be h4
      const mainHeading = screen.getByRole('heading', { level: 4 })
      expect(mainHeading).toHaveTextContent('About KickTalk')
      
      // Section headings should be h5
      const sectionHeadings = screen.getAllByRole('heading', { level: 5 })
      expect(sectionHeadings.length).toBeGreaterThan(0)
    })

    it('should display content in logical order', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      const sections = container.querySelectorAll('.settingsContentSection')
      
      // First section: Creators
      expect(sections[0]).toContainElement(screen.getByText('Meet the Creators'))
      
      // Second section: App description
      expect(sections[1]).toContainElement(screen.getAllByText('About KickTalk')[1]) // Second occurrence
      
      // Third section: Version info
      expect(sections[2]).toContainElement(screen.getByText('Current Version:'))
    })

    it('should properly separate developer information', () => {
      const { container } = render(<AboutSection appInfo={mockAppInfo} />)
      
      const devSeparator = container.querySelector('.settingsContentAboutDevSeparator')
      const devContainers = container.querySelectorAll('.settingsContentAboutDev')
      
      expect(devSeparator).toBeInTheDocument()
      expect(devContainers).toHaveLength(2)
      
      // Separator should be between the two developer sections
      const separatorParent = devSeparator.parentElement
      const separatorIndex = Array.from(separatorParent.children).indexOf(devSeparator)
      
      expect(separatorIndex).toBeGreaterThan(0)
      expect(separatorIndex).toBeLessThan(separatorParent.children.length - 1)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed appInfo gracefully', () => {
      const malformedAppInfo = {
        appVersion: null,
        someOtherProp: 'value',
        nested: { prop: 'value' }
      }
      
      expect(() => {
        render(<AboutSection appInfo={malformedAppInfo} />)
      }).not.toThrow()
    })

    it('should handle appInfo with extra properties', () => {
      const extendedAppInfo = {
        ...mockAppInfo,
        extraProp1: 'value1',
        extraProp2: 'value2',
        nestedProp: { nested: 'value' }
      }
      
      expect(() => {
        render(<AboutSection appInfo={extendedAppInfo} />)
      }).not.toThrow()
      
      expect(screen.getByText('1.2.3')).toBeInTheDocument()
    })

    it('should handle missing component props', () => {
      expect(() => {
        render(<AboutSection />)
      }).not.toThrow()
    })

    it('should handle extremely long version strings', () => {
      const longVersionAppInfo = {
        appVersion: 'v1.2.3-beta.1+build.123.abc.def.ghi.jkl.mno.pqr.stu.vwx.yz'
      }
      
      render(<AboutSection appInfo={longVersionAppInfo} />)
      
      expect(screen.getByText(longVersionAppInfo.appVersion)).toBeInTheDocument()
    })

    it('should handle special characters in version string', () => {
      const specialVersionAppInfo = {
        appVersion: '1.2.3-α-β-γ-🚀-测试'
      }
      
      expect(() => {
        render(<AboutSection appInfo={specialVersionAppInfo} />)
      }).not.toThrow()
      
      expect(screen.getByText(specialVersionAppInfo.appVersion)).toBeInTheDocument()
    })

    it('should handle boolean appVersion', () => {
      const booleanVersionAppInfo = {
        appVersion: true
      }
      
      expect(() => {
        render(<AboutSection appInfo={booleanVersionAppInfo} />)
      }).not.toThrow()
    })

    it('should handle array appVersion', () => {
      const arrayVersionAppInfo = {
        appVersion: [1, 2, 3]
      }
      
      expect(() => {
        render(<AboutSection appInfo={arrayVersionAppInfo} />)
      }).not.toThrow()
    })
  })

  describe('Performance and Rendering', () => {
    it('should render quickly', () => {
      const start = performance.now()
      render(<AboutSection appInfo={mockAppInfo} />)
      const end = performance.now()
      
      expect(end - start).toBeLessThan(100) // Should render within 100ms
    })

    it('should not cause memory leaks with repeated renders', () => {
      const { rerender } = render(<AboutSection appInfo={mockAppInfo} />)
      
      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<AboutSection appInfo={mockAppInfo} />)
      }
      
      expect(screen.getByText('About KickTalk')).toBeInTheDocument()
    })

    it('should handle rapid prop changes', () => {
      const { rerender } = render(<AboutSection appInfo={mockAppInfo} />)
      
      const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0']
      
      versions.forEach(version => {
        rerender(<AboutSection appInfo={{ appVersion: version }} />)
        expect(screen.getByText(version)).toBeInTheDocument()
      })
    })

    it('should maintain stable DOM structure across renders', () => {
      const { container, rerender } = render(<AboutSection appInfo={mockAppInfo} />)
      
      const initialHTML = container.innerHTML
      
      rerender(<AboutSection appInfo={mockAppInfo} />)
      
      expect(container.innerHTML).toBe(initialHTML)
    })
  })

  describe('Integration and Component Composition', () => {
    it('should work as part of larger settings dialog', () => {
      // Simulate being rendered within a larger settings context
      const { container } = render(
        <div className="settingsContent">
          <AboutSection appInfo={mockAppInfo} />
        </div>
      )
      
      expect(container.querySelector('.settingsContent .settingsContentAbout')).toBeInTheDocument()
    })

    it('should not interfere with other components', () => {
      const { container } = render(
        <div>
          <div data-testid="other-component">Other Component</div>
          <AboutSection appInfo={mockAppInfo} />
          <div data-testid="another-component">Another Component</div>
        </div>
      )
      
      expect(screen.getByTestId('other-component')).toBeInTheDocument()
      expect(screen.getByTestId('another-component')).toBeInTheDocument()
      expect(screen.getByText('About KickTalk')).toBeInTheDocument()
    })

    it('should maintain functionality when nested deeply', () => {
      render(
        <div>
          <div>
            <div>
              <div>
                <AboutSection appInfo={mockAppInfo} />
              </div>
            </div>
          </div>
        </div>
      )
      
      expect(screen.getByText('Meet the Creators')).toBeInTheDocument()
      expect(screen.getByText('1.2.3')).toBeInTheDocument()
      
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(4)
    })
  })

  describe('Content Validation', () => {
    it('should display all required developer information', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      // DRKNESS_x info
      expect(screen.getByText('DRKNESS_x')).toBeInTheDocument()
      expect(screen.getByText('Developer & Designer')).toBeInTheDocument()
      
      // ftk789 info
      expect(screen.getByText('ftk789')).toBeInTheDocument()
      expect(screen.getByText('Developer')).toBeInTheDocument()
      
      // Should have correct number of social links
      expect(screen.getAllByText('Open Twitter')).toHaveLength(2)
      expect(screen.getAllByText('Open Channel')).toHaveLength(2)
    })

    it('should display complete application description', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const expectedDescription = 'We created this application because we felt the current solution Kick was offering couldn\'t meet the needs of users who want more from their chatting experience. From multiple chatrooms to emotes and native Kick functionality all in one place.'
      
      expect(screen.getByText(expectedDescription)).toBeInTheDocument()
    })

    it('should have correct social media URLs', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      const links = screen.getAllByRole('link')
      const hrefs = links.map(link => link.getAttribute('href'))
      
      expect(hrefs).toContain('https://x.com/drkerco')
      expect(hrefs).toContain('https://x.com/ftk789yt')
      expect(hrefs).toContain('https://kick.com/drkness-x')
      expect(hrefs).toContain('https://kick.com/ftk789')
    })

    it('should display version information correctly', () => {
      render(<AboutSection appInfo={mockAppInfo} />)
      
      expect(screen.getByText('Current Version:')).toBeInTheDocument()
      expect(screen.getByText('1.2.3')).toBeInTheDocument()
    })
  })
})