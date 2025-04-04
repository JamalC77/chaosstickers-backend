import { RequestHandler } from 'express';
import { prisma } from '../server'; // Adjust import based on your prisma client instance location
import { GeneratedImage } from '@prisma/client'; // Import the GeneratedImage type

// Placeholder for getting purchased designs
export const getPurchasedDesignsController: RequestHandler = async (req, res) => {
  // TODO: Implement logic to get userId from authenticated request
  const userId = 1; // Placeholder - replace with actual user ID from auth

  try {
    // Fetch orders for the user, including items with image URLs
    const orders = await prisma.order.findMany({
      where: { userId: userId },
      include: {
        items: {
          select: {
            imageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Optional: order by most recent purchase
      },
    });

    // Extract unique image URLs
    const purchasedDesigns = [
      ...new Set(orders.flatMap(order => order.items.map(item => item.imageUrl))),
    ];

    res.status(200).json({ designs: purchasedDesigns });
  } catch (error) {
    console.error('Error fetching purchased designs:', error);
    res.status(500).json({ error: 'Failed to fetch purchased designs' });
  }
};

// Gets all recent designs, regardless of purchase status
export const getRecentDesignsController: RequestHandler = async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    // --- DEBUG LOGGING START ---
    console.log(`[getRecentDesigns] Received page: ${req.query.page}, Parsed page: ${page}`);
    console.log(`[getRecentDesigns] Limit: ${limit}, Calculated skip: ${skip}`);
    // --- DEBUG LOGGING END ---

    // Fetch the full GeneratedImage objects
    const recentDesignsData: GeneratedImage[] = await prisma.generatedImage.findMany({ // Type the result
       orderBy: [
         { createdAt: 'desc' },
         { id: 'asc' }
       ],
       // No 'select' clause needed - fetch all fields by default
       skip: skip,
       take: limit,
     });

     const totalDesigns = await prisma.generatedImage.count();

     // --- DEBUG LOGGING START ---
     const totalPages = Math.ceil(totalDesigns / limit)
     console.log(`[getRecentDesigns] Found totalDesigns: ${totalDesigns}, Calculated totalPages: ${totalPages}`);
     // --- DEBUG LOGGING END ---


    // No mapping needed, recentDesignsData already has the full objects
    console.log(`[getRecentDesigns] Returning ${recentDesignsData.length} full design objects for page ${page}`);

    res.status(200).json({
        designs: recentDesignsData, // Send the full array of objects
        pagination: {
            currentPage: page,
            pageSize: limit,
            totalItems: totalDesigns,
            totalPages: totalPages, // Use calculated totalPages
        }
     });
  } catch (error) {
    console.error('Error fetching recent designs:', error);
    res.status(500).json({ error: 'Failed to fetch recent designs' });
  }
}; 