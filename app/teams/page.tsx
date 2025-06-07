import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"

const teams = [
  {
    id: 1,
    name: "Generals",
    manager: "Cody Patton",
    email: "pattoncody@hotmail.com",
    phone: "404.368.2399",
    logo: "/logos/1-3121.png",
  },
  {
    id: 2,
    name: "Leeds United",
    manager: "Josh Kowall",
    email: "joshkowall@hotmail.com",
    phone: "",
    logo: "/logos/3-1698266188.png",
  },
  {
    id: 3,
    name: "Masters of Disaster",
    manager: "Alex Destino",
    email: "alexdino1@gmail.com",
    phone: "6784801872",
    logo: "/logos/4-12144.gif",
  },
  {
    id: 4,
    name: "Relegators",
    manager: "Patrick Williams",
    email: "patro7@hotmail.com",
    phone: "",
    logo: "/logos/5-1639702560.jpg",
  },
  {
    id: 5,
    name: "Rock Stars",
    manager: "Mike Grady",
    email: "mike.grady@live.com",
    phone: "",
    logo: "/logos/6-1724002593.jpg",
  },
  {
    id: 6,
    name: "Egyptian Magicians",
    manager: "Seth Lively",
    email: "sethlively@gmail.com",
    phone: "",
    logo: "/logos/7-234011.jpg",
  },
  {
    id: 7,
    name: "Homers Heroes",
    manager: "Michael",
    email: "michael.mignatti@gmail.com",
    phone: "+1512-698-9732",
    logo: "/logos/8-1706630320.jpg",
  },
  {
    id: 8,
    name: "Kentucky Football Club",
    manager: "Gustave Carruth",
    email: "gustaveneri@gmail.com",
    phone: "",
    logo: "/logos/10-117624.png",
  },
  {
    id: 9,
    name: "LA Losers",
    manager: "Eric Harvill",
    email: "eharvill13@yahoo.com",
    phone: "770-652-2698",
    logo: "/logos/11-76851.jpg",
  },
  {
    id: 10,
    name: "Munich Cowboys",
    manager: "Brad Venuti",
    email: "bvenuti75@gmail.com",
    phone: "978 317-9308",
    logo: "/logos/72x72-r.jpg",
  },
]

export default function TeamsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">MLFF Teams</h1>
          <p className="text-xl text-gray-600">Meet the franchises of Major League Fantasy Football</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map((team) => (
            <Card key={team.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="text-center pb-4">
                <div className="relative mx-auto mb-4">
                  <Image
                    src={team.logo || "/placeholder.svg"}
                    alt={`${team.name} logo`}
                    width={80}
                    height={80}
                    className="rounded-full border-4 border-white shadow-lg bg-white"
                  />
                </div>
                <CardTitle className="text-xl">{team.name}</CardTitle>
                <div className="text-base text-gray-700 mt-2">Manager: <span className="font-semibold">{team.manager}</span></div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-sm">
                  <div><span className="font-medium">Email:</span> <a href={`mailto:${team.email}`} className="text-blue-600 underline">{team.email}</a></div>
                  {team.phone && <div><span className="font-medium">Phone:</span> <span>{team.phone}</span></div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
