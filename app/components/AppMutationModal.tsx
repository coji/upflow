import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from '@chakra-ui/react'
import { useNavigate } from '@remix-run/react'

interface AppMutationModalProps {
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  cancelNavigateTo?: string
}

export const AppMutationModal = ({ title, children, footer, cancelNavigateTo = '..' }: AppMutationModalProps) => {
  const navigate = useNavigate()

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        navigate(cancelNavigateTo)
      }}
      closeOnEsc
    >
      <ModalOverlay></ModalOverlay>
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>{children}</ModalBody>

        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </Modal>
  )
}
