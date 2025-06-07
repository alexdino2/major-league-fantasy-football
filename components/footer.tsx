import Link from "next/link"
import { ExternalLink } from "lucide-react"
import Image from "next/image"

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Image src="/images/mlff-logo.jpg" alt="MLFF Logo" width={32} height={32} className="rounded-lg" />
              <span className="font-bold text-xl">Major League Fantasy Football</span>
            </div>
            <p className="text-gray-300 mb-4">
              The premier fantasy football league featuring 10 competitive teams and over a decade of history.
            </p>
            <Link
              href="https://mlffatl.football.cbssports.com/"
              target="_blank"
              className="inline-flex items-center text-green-400 hover:text-green-300 transition-colors"
            >
              Visit CBS Sports Site
              <ExternalLink className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/news" className="text-gray-300 hover:text-white transition-colors">
                  Latest News
                </Link>
              </li>
              <li>
                <Link href="/history" className="text-gray-300 hover:text-white transition-colors">
                  League History
                </Link>
              </li>
              <li>
                <Link href="/media" className="text-gray-300 hover:text-white transition-colors">
                  Media Gallery
                </Link>
              </li>
              <li>
                <Link href="/teams" className="text-gray-300 hover:text-white transition-colors">
                  Team Profiles
                </Link>
              </li>
              <li>
                <Link href="/rules" className="text-gray-300 hover:text-white transition-colors">
                  League Rules
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-4">League Info</h3>
            <ul className="space-y-2 text-gray-300">
              <li>10 Team League</li>
              <li>PPR Scoring</li>
              <li>Snake Draft</li>
              <li>Weekly Matchups</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} Major League Fantasy Football. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
